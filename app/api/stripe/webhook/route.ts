import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerConfirmationEssaiPlateforme, envoyerPaiementEchouePlateforme, envoyerConfirmationAnnulationPlateforme } from '@/lib/emails'
import { resoudreClientParEmail, traiterPaiementExpress } from '@/lib/webhook-paiement'
import { traiterMajCompteOperationnel } from '@/lib/pret-a-vendre-suivi'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ erreur: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ erreur: 'Signature invalide' }, { status: 400 })
  }

  // Log admin (page /dashboard/admin/stripe-events) — upsert sur
  // stripe_event_id pour qu'un rejeu Stripe mette à jour la même ligne au
  // lieu d'en créer une nouvelle. N'affecte jamais le traitement métier
  // ci-dessous : une erreur d'écriture du log ne doit jamais faire échouer
  // le webhook (Stripe réessaierait indéfiniment un event déjà traité).
  const logAdmin = createAdminClient()
  await logAdmin.from('stripe_events').upsert(
    { stripe_event_id: event.id, type: event.type, statut: 'recu' },
    { onConflict: 'stripe_event_id' }
  )

  try {
    // mode 'payment' (achat de beat) n'arrive plus jamais ici depuis le
    // passage à la page de paiement custom (Phase 9, PaymentIntent via
    // /api/stripe/express-checkout) — seules les souscriptions créent encore
    // une Checkout Session côté plateforme.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.metadata?.type === 'abonnement_plateforme') {
        await traiterAbonnementPlateformeCree(session)
      }
    }

    // Seuls les abonnements plateforme (beatmaker → My Producer, Étape 8b)
    // vivent encore sur ce compte : les abonnements boutique sont chez le
    // beatmaker depuis le paiement direct (2026-10-01) et passent par
    // /api/stripe/webhook-connect. Les events invoice n'ont pas de
    // metadata.type : l'abonnement plateforme est reconnu en base.
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      if (await estAbonnementPlateforme(invoice)) {
        await traiterPaiementAbonnementPlateforme(invoice)
      }
    }

    if (event.type === 'invoice.payment_failed') {
      await traiterEchecRenouvellementAbonnement(event.data.object as Stripe.Invoice)
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      if (subscription.metadata?.type === 'abonnement_plateforme') {
        await traiterMajAbonnementPlateforme(subscription)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      if (subscription.metadata?.type === 'abonnement_plateforme') {
        await traiterAnnulationAbonnementPlateforme(subscription)
      }
    }

    // account.updated d'un compte connecté n'arrive en pratique que sur
    // /api/stripe/webhook-connect (constaté au lot 1 de la Phase 13 : jamais
    // reçu ici) — gardé au cas où l'endpoint plateforme l'écouterait aussi.
    if (event.type === 'account.updated') {
      await traiterMajCompteOperationnel(event.data.object as Stripe.Account)
    }

    if (event.type === 'checkout.session.expired') {
      await traiterExpirationTentative(event.data.object as Stripe.Checkout.Session)
    }

    if (event.type === 'payment_intent.payment_failed') {
      await traiterEchecTentative(event.data.object as Stripe.PaymentIntent)
    }

    // Scopé à metadata.type === 'achat_express' : sans ce garde, cet event se
    // déclencherait aussi pour les PaymentIntents internes des Checkout
    // Sessions classiques (déjà traitées par checkout.session.completed),
    // créant une commande en double.
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      if (paymentIntent.metadata?.type === 'achat_express') {
        await traiterPaiementExpress(paymentIntent, null)
      }
    }
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err)
    console.error('[webhook] Erreur traitement event', event.type, ':', erreur)
    await logAdmin.from('stripe_events').update({ statut: 'echoue', erreur, traite_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
    // 200 quand même : la signature est valide, l'erreur vient de notre
    // traitement — répondre en erreur ferait retenter Stripe indéfiniment
    // le même event sans que le rapport /dashboard/admin/stripe-events ne
    // soit consulté entre-temps.
    return NextResponse.json({ ok: true })
  }

  await logAdmin.from('stripe_events').update({ statut: 'traite', traite_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
  return NextResponse.json({ ok: true })
}

async function traiterExpirationTentative(session: Stripe.Checkout.Session) {
  const supabase = createAdminClient()
  const email = session.customer_details?.email?.toLowerCase().trim() ?? null
  const clientId = await resoudreClientParEmail(supabase, email)

  const { error } = await supabase
    .from('tentatives_paiement')
    .update({ statut: 'expiree', email, client_id: clientId })
    .eq('stripe_session_id', session.id)
    .eq('statut', 'creee')

  if (error) console.error('[webhook] Erreur expiration tentative_paiement:', JSON.stringify(error))
}

async function traiterEchecTentative(paymentIntent: Stripe.PaymentIntent) {
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent.id, limit: 1 })
  const session = sessions.data[0]
  if (!session) return

  const supabase = createAdminClient()
  const email = session.customer_details?.email?.toLowerCase().trim() ?? null
  const clientId = await resoudreClientParEmail(supabase, email)

  const { error } = await supabase
    .from('tentatives_paiement')
    .update({ statut: 'echouee', email, client_id: clientId })
    .eq('stripe_session_id', session.id)
    .eq('statut', 'creee')

  if (error) console.error('[webhook] Erreur échec tentative_paiement:', JSON.stringify(error))
}

// ============================================================
// Étape 8b — Abonnement plateforme (beatmaker → My Producer)
// ============================================================
// Pas
// de Stripe Connect (paiement direct sur le compte principal, c'est le
// beatmaker qui paie), pas d'automatisations/emails pour cette V1 minimale
// (cadrage 2026-07-24). Le blocage d'accès dashboard est volontairement
// différé à un lot séparé — ces handlers ne font QUE tenir
// abonnements_plateforme à jour, rien d'autre.

async function traiterAbonnementPlateformeCree(session: Stripe.Checkout.Session) {
  const meta = session.metadata
  if (!meta?.beatmaker_id) return

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id ?? null
  if (!subscriptionId) return

  const supabase = createAdminClient()

  const { data: existant } = await supabase
    .from('abonnements_plateforme')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (existant) {
    console.log('[webhook] Abonnement plateforme déjà créé:', subscriptionId)
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const finPeriode = subscription.items.data[0]?.current_period_end
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
  const prixCents = subscription.items.data[0]?.price.unit_amount ?? 0

  const periode = meta.periode === 'annuel' ? 'annuel' : 'mensuel'
  const essaiFinLe = trialEnd ?? new Date().toISOString()

  const { error } = await supabase.from('abonnements_plateforme').insert({
    beatmaker_id: meta.beatmaker_id,
    plan: 'standard',
    periode,
    prix: prixCents,
    devise: 'EUR',
    en_essai: subscription.status === 'trialing',
    essai_fin_le: essaiFinLe,
    statut: subscription.status === 'trialing' ? 'en_essai' : 'actif',
    date_debut: new Date().toISOString(),
    date_fin: trialEnd ?? (finPeriode ? new Date(finPeriode * 1000).toISOString() : null),
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
  })

  if (error) {
    console.error('[webhook] Erreur insert abonnement_plateforme:', JSON.stringify(error))
    return
  }
  console.log('[webhook] Abonnement plateforme créé pour', meta.beatmaker_id)

  const { data: beatmaker } = await supabase.from('beatmakers').select('email').eq('id', meta.beatmaker_id).maybeSingle()
  if (beatmaker?.email) {
    await envoyerConfirmationEssaiPlateforme({
      to: beatmaker.email, beatmakerId: meta.beatmaker_id, periode, prixEuros: prixCents / 100, essaiFinLe,
    })
  }
}

async function traiterMajAbonnementPlateforme(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const status = subscription.status
  const statut = status === 'active' ? 'actif'
    : status === 'trialing' ? 'en_essai'
    : status === 'past_due' ? 'impaye'
    : 'annule'
  const enEssai = status === 'trialing'
  const finPeriode = subscription.items.data[0]?.current_period_end

  // subscription.cancel_at est renseigné aussi bien pour une annulation "à la
  // fin de la période en cours" que pour une annulation pendant l'essai (où
  // cancel_at_period_end reste à false, status reste "trialing") — c'est le
  // signal le plus fiable pour prévenir d'une annulation déjà programmée
  // avant qu'elle ne soit effective (découvert en testant le 2026-07-24).
  const annulationPrevueLe = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null

  // Chargé avant la mise à jour pour détecter l'entrée en impayé (même
  // pattern que traiterMajAbonnement pour abonnements_boutique) — un email
  // ne doit partir qu'au moment où le statut BASCULE vers 'impaye', pas à
  // chaque event Stripe reçu tant qu'il y reste.
  const { data: avant } = await supabase
    .from('abonnements_plateforme')
    .select('statut, beatmaker_id, beatmakers(email)')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  const { error } = await supabase
    .from('abonnements_plateforme')
    .update({
      statut,
      en_essai: enEssai,
      annulation_prevue_le: annulationPrevueLe,
      ...(finPeriode ? { date_fin: new Date(finPeriode * 1000).toISOString() } : {}),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('[webhook] Erreur maj abonnement_plateforme:', JSON.stringify(error))
    return
  }
  console.log('[webhook] Abonnement plateforme mis à jour:', subscription.id, statut)

  const entreEnImpaye = statut === 'impaye' && avant?.statut !== 'impaye'
  if (entreEnImpaye && avant) {
    const beatmaker = Array.isArray(avant.beatmakers) ? avant.beatmakers[0] : avant.beatmakers
    if (beatmaker?.email) await envoyerPaiementEchouePlateforme({ to: beatmaker.email, beatmakerId: avant.beatmaker_id })
  }
}

async function traiterAnnulationAbonnementPlateforme(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('abonnements_plateforme')
    .update({ statut: 'annule', en_essai: false, date_annulation: new Date().toISOString(), annulation_prevue_le: null })
    .eq('stripe_subscription_id', subscription.id)
    .select('beatmaker_id, beatmakers(email)')
    .maybeSingle()

  if (error) {
    console.error('[webhook] Erreur annulation abonnement_plateforme:', JSON.stringify(error))
    return
  }
  console.log('[webhook] Abonnement plateforme annulé:', subscription.id)

  const beatmaker = Array.isArray(data?.beatmakers) ? data.beatmakers[0] : data?.beatmakers
  if (beatmaker?.email && data) await envoyerConfirmationAnnulationPlateforme({ to: beatmaker.email, beatmakerId: data.beatmaker_id })
}

// Les events invoice n'ont pas metadata.type directement dessus — on
// regarde si la subscription liée existe côté abonnements_plateforme avant
// de savoir quel traitement appliquer.
async function estAbonnementPlateforme(invoice: Stripe.Invoice): Promise<boolean> {
  const subRaw = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRaw === 'string' ? subRaw : subRaw?.id ?? null
  if (!subscriptionId) return false

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('abonnements_plateforme')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  return !!data
}

async function traiterPaiementAbonnementPlateforme(invoice: Stripe.Invoice) {
  const billing = invoice.billing_reason
  // subscription_create n'a rien à facturer pendant l'essai (montant à 0) —
  // seul un vrai renouvellement/changement doit repasser le statut à 'actif'.
  if (billing !== 'subscription_cycle' && billing !== 'subscription_update') return

  const subRaw = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRaw === 'string' ? subRaw : subRaw?.id ?? null
  if (!subscriptionId) return

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('abonnements_plateforme')
    .update({ statut: 'actif', en_essai: false })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) console.error('[webhook] Erreur paiement abonnement_plateforme:', JSON.stringify(error))
  else console.log('[webhook] Paiement abonnement plateforme confirmé:', subscriptionId)
}

// Trace chaque échec de renouvellement dans tentatives_paiement (rien n'était
// visible jusqu'ici : pas de commande puisque rien n'a été payé). Une ligne
// par facture Stripe (idempotent sur stripe_invoice_id) — visible sur la
// fiche abonnement, découvert manquant en testant l'automatisation "Abonnement
// en attente" le 2026-07-08.
async function traiterEchecRenouvellementAbonnement(invoice: Stripe.Invoice) {
  const billing = invoice.billing_reason
  if (billing !== 'subscription_create' && billing !== 'subscription_cycle' && billing !== 'subscription_update') return

  const subRaw = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRaw === 'string' ? subRaw : subRaw?.id ?? null
  if (!subscriptionId) return

  const supabase = createAdminClient()

  // Abonnement plateforme (rang 9 ROADMAP, 2026-08-31) : les échecs des
  // abonnements boutique sont tracés par /api/stripe/webhook-connect.
  const { data: aboPlateforme } = await supabase
    .from('abonnements_plateforme')
    .select('id, beatmaker_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (!aboPlateforme) {
    console.log('[webhook] invoice.payment_failed — aucun abonnement plateforme trouvé:', subscriptionId)
    return
  }

  const { error } = await supabase.from('tentatives_paiement').upsert({
    type: 'renouvellement_abonnement_plateforme',
    beatmaker_id: aboPlateforme.beatmaker_id,
    abonnement_plateforme_id: aboPlateforme.id,
    prix: (invoice.amount_due ?? 0) / 100,
    stripe_invoice_id: invoice.id,
    statut: 'echouee',
  }, { onConflict: 'stripe_invoice_id' })

  if (error) console.error('[webhook] Erreur insert tentative renouvellement plateforme:', JSON.stringify(error))
  else console.log('[webhook] Échec de renouvellement plateforme tracé pour abo', aboPlateforme.id)
}


