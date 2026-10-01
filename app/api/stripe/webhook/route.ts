import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmationAbonnement, envoyerNouvelAbonnement, envoyerConfirmationEssaiPlateforme, envoyerPaiementEchouePlateforme, envoyerConfirmationAnnulationPlateforme } from '@/lib/emails'
import { automatisationActive } from '@/lib/automatisations'
import { resoudreClientParEmail, resoudreOuCreerClient, traiterPaiementExpress } from '@/lib/webhook-paiement'
import { traiterMajCompteOperationnel } from '@/lib/pret-a-vendre-suivi'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { EvenementARejouer, enregistrerPaiementAbonnement, tracerEchecRenouvellementBoutique, traiterAnnulationAbonnementBoutique, traiterMajAbonnementBoutique } from '@/lib/abonnement-boutique-webhook'

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
      if (session.mode === 'subscription') {
        if (session.metadata?.type === 'abonnement_plateforme') {
          await traiterAbonnementPlateformeCree(session)
        } else {
          await traiterAbonnementCree(session)
        }
      }
    }

    // Les events invoice/subscription n'ont pas de metadata.type directement
    // dessus (contrairement à checkout.session.completed) — on cherche
    // d'abord côté abonnements_plateforme (Étape 8b), sinon on retombe sur le
    // traitement boutique existant. Les deux tables ont des
    // stripe_subscription_id distincts, jamais de collision possible.
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      if (await estAbonnementPlateforme(invoice)) {
        await traiterPaiementAbonnementPlateforme(invoice)
      } else {
        await traiterPaiementAbonnement(invoice)
      }
    }

    if (event.type === 'invoice.payment_failed') {
      await traiterEchecRenouvellementAbonnement(event.data.object as Stripe.Invoice)
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      if (subscription.metadata?.type === 'abonnement_plateforme') {
        await traiterMajAbonnementPlateforme(subscription)
      } else {
        await traiterMajAbonnementBoutique(subscription)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      if (subscription.metadata?.type === 'abonnement_plateforme') {
        await traiterAnnulationAbonnementPlateforme(subscription)
      } else {
        await traiterAnnulationAbonnementBoutique(subscription)
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
    // Abonnement payé pas encore enregistrable : Stripe renverra l'événement.
    if (err instanceof EvenementARejouer) return NextResponse.json({ erreur }, { status: 500 })
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

// Crée la ligne abonnements_boutique directement depuis le webhook plutôt que
// depuis la redirection navigateur (/api/stripe/abonnement/succes) : le webhook
// arrive de serveur à serveur, quasi instantanément, alors que la redirection
// dépend du navigateur du client et n'est pas garantie (onglet fermé, connexion
// lente...). Sans ça, invoice.payment_succeeded peut arriver avant que la ligne
// existe et abandonner silencieusement (découvert en testant le 2026-07-06).
async function traiterAbonnementCree(session: Stripe.Checkout.Session) {
  const meta = session.metadata
  if (!meta?.beatmaker_id) return

  // Normalisé en minuscule — stocké tel quel dans acheteur_email, sinon les
  // comparaisons ultérieures (.eq('acheteur_email', ...)) ratent selon la
  // casse tapée au checkout (bug découvert en testant Phase 5.9, 2026-07-16).
  const email = session.customer_details?.email?.toLowerCase().trim() ?? null
  const nom = session.customer_details?.name ?? null
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id ?? null

  const supabase = createAdminClient()

  // Idempotence : si le webhook est rejoué (ou si la course inverse se produit
  // un jour), ne pas créer une 2e ligne pour le même abonnement
  if (subscriptionId) {
    const { data: existant } = await supabase
      .from('abonnements_boutique')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle()
    if (existant) {
      console.log('[webhook] Abonnement déjà créé:', subscriptionId)
      return
    }
  }

  let clientId = meta.client_id || await resoudreOuCreerClient(supabase, email, nom)
  if (!clientId) {
    throw new EvenementARejouer(`Client introuvable pour l'abonnement, session ${session.id}`)
  }

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('abo_prix, tva_active, tva_taux')
    .eq('id', meta.beatmaker_id)
    .single()

  const dateDebut = new Date().toISOString()
  const dateFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const ligne = {
    beatmaker_id: meta.beatmaker_id,
    acheteur_email: email,
    acheteur_nom: nom,
    plan: 'standard',
    periode: 'mensuel',
    prix: beatmaker?.abo_prix ?? 0,
    // TVA toujours absorbée (jamais ajoutée) — figée pour cet abonné à cet
    // instant, jamais recalculée même si le beatmaker change son réglage
    // TVA ensuite. Sert uniquement à extraire HT/TVA du prix déjà payé.
    tva_taux: beatmaker?.tva_active && beatmaker?.tva_taux ? beatmaker.tva_taux : null,
    devise: 'EUR',
    statut: 'actif',
    methode_paiement: 'stripe',
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    en_essai: false,
    essai_fin_le: null,
    date_debut: dateDebut,
    date_fin: dateFin,
    source_marketing: meta.source_marketing ?? 'direct',
  }

  let { data: abonnement, error } = await supabase.from('abonnements_boutique')
    .insert({ ...ligne, client_id: clientId }).select('id').single()

  // Fiche visée disparue entre-temps (fiche invitée fusionnée dans le vrai
  // compte par /api/stripe/abonnement/succes) : la fiche à jour se retrouve
  // par email.
  if (error?.code === '23503' && email) {
    const clientIdParEmail = await resoudreOuCreerClient(supabase, email, nom)
    if (clientIdParEmail) {
      clientId = clientIdParEmail
      ;({ data: abonnement, error } = await supabase.from('abonnements_boutique')
        .insert({ ...ligne, client_id: clientId }).select('id').single())
    }
  }

  if (error || !abonnement) {
    throw new EvenementARejouer(`Insert abonnement_boutique refusé (${subscriptionId}) : ${JSON.stringify(error)}`)
  }

  console.log('[webhook] Abonnement créé:', abonnement.id)

  if (email) {
    await confirmationAbonnement({
      to: email,
      beatmakerId: meta.beatmaker_id,
      abonnementId: abonnement.id,
      clientId,
    }).catch(err => console.error('[webhook] Erreur envoi email confirmation abonnement:', err))
  }

  // « Nouvelle vente » au beatmaker (Phase 13, lot 3) — nouvel abonnement
  // seulement, jamais un renouvellement (traiterPaiementAbonnement).
  await envoyerNouvelAbonnement({ beatmakerId: meta.beatmaker_id, periode: 'mensuel', prixCents: Number(beatmaker?.abo_prix ?? 0) })
    .catch(err => console.error('[webhook] Erreur envoi email nouvel abonnement:', err))

  if (await automatisationActive(meta.beatmaker_id, 'bienvenue_abonnement')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: meta.beatmaker_id,
      client_id: clientId,
      type: 'bienvenue_abonnement',
      reference_id: abonnement.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
  }
}

// ============================================================
// Étape 8b — Abonnement plateforme (beatmaker → My Producer)
// ============================================================
// Même patron que les abonnements boutique ci-dessus, en plus simple : pas
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

type AboLookup = { id: string; client_id: string | null; beatmaker_id: string; prix: number; tva_taux: number | null; source_marketing: string | null }

async function attendreAbonnement(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  tentatives = 5,
  delaiMs = 1500,
): Promise<AboLookup | null> {
  for (let i = 0; i < tentatives; i++) {
    const { data: abo } = await supabase
      .from('abonnements_boutique')
      .select('id, client_id, beatmaker_id, prix, tva_taux, source_marketing')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle()
    if (abo) return abo
    if (i < tentatives - 1) await new Promise(r => setTimeout(r, delaiMs))
  }
  return null
}

async function traiterPaiementAbonnement(invoice: Stripe.Invoice) {
  // Uniquement les paiements de création ou de renouvellement d'abonnement.
  // subscription_update couvre notamment la fin d'essai forcée (trial_end
  // déclenche une facture immédiate avec cette raison, pas subscription_cycle)
  // et toute autre modification d'abonnement générant un vrai paiement.
  const billing = invoice.billing_reason
  if (billing !== 'subscription_create' && billing !== 'subscription_cycle' && billing !== 'subscription_update') return

  // Stripe v22 : l'abonnement est dans invoice.parent.subscription_details.subscription
  const subRaw = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRaw === 'string' ? subRaw : subRaw?.id ?? null
  if (!subscriptionId) return

  const supabase = createAdminClient()

  // Pour une toute nouvelle souscription, invoice.payment_succeeded arrive en
  // fait AVANT checkout.session.completed (celui qui crée la ligne
  // abonnements_boutique) — pas après, contrairement à l'ordre intuitif.
  // Quelques nouvelles tentatives espacées laissent le temps à cette ligne
  // d'apparaître plutôt que d'abandonner immédiatement (confirmé en testant
  // le 2026-07-06 : l'écart observé était de l'ordre d'1 seconde).
  const abo = await attendreAbonnement(supabase, subscriptionId)

  if (!abo) {
    // 1er paiement arrivé avant l'enregistrement de l'abonnement : Stripe
    // renverra l'événement, la commande et la facture se créeront alors.
    if (billing === 'subscription_create') {
      throw new EvenementARejouer(`Abonnement boutique pas encore enregistré pour le 1er paiement : ${subscriptionId}`)
    }
    console.log('[webhook] invoice.payment_succeeded — abonnement boutique non trouvé:', subscriptionId)
    return
  }

  await enregistrerPaiementAbonnement(supabase, abo, invoice)
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

  if (await tracerEchecRenouvellementBoutique(supabase, invoice, subscriptionId)) return

  // Pas un abonnement boutique — vérifier l'abonnement plateforme (rang 9
  // ROADMAP, 2026-08-31) : jusqu'ici aucun échec de paiement de l'abonnement
  // beatmaker → My Producer n'était tracé, contrairement au côté boutique.
  const { data: aboPlateforme } = await supabase
    .from('abonnements_plateforme')
    .select('id, beatmaker_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (!aboPlateforme) {
    console.log('[webhook] invoice.payment_failed — aucun abonnement (boutique ou plateforme) trouvé:', subscriptionId)
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


