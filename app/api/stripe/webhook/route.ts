import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmationAbonnement, confirmationDemandeAnnulation, annulationAbonnement, envoyerConfirmationEssaiPlateforme, envoyerPaiementEchouePlateforme, envoyerConfirmationAnnulationPlateforme } from '@/lib/emails'
import { automatisationActive } from '@/lib/automatisations'
import { resoudreClientParEmail, resoudreOuCreerClient, traiterPaiement, traiterPaiementExpress } from '@/lib/webhook-paiement'
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
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription') {
        if (session.metadata?.type === 'abonnement_plateforme') {
          await traiterAbonnementPlateformeCree(session)
        } else {
          await traiterAbonnementCree(session)
        }
      } else {
        // null = destination charge (PaymentIntent sur le compte plateforme)
        // — ce webhook ne reçoit que des events platform-level, jamais
        // d'events venant d'un compte connecté (voir webhook-connect/route.ts).
        await traiterPaiement(session, null)
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
        await traiterMajAbonnement(subscription)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      if (subscription.metadata?.type === 'abonnement_plateforme') {
        await traiterAnnulationAbonnementPlateforme(subscription)
      } else {
        await traiterAnnulationAbonnement(subscription)
      }
    }

    if (event.type === 'account.updated') {
      await traiterCompteConnecte(event.data.object as Stripe.Account)
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

async function traiterMajAbonnement(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const status = subscription.status
  // actif = active ou trialing ; impaye = renouvellement en échec mais Stripe
  // retente encore (past_due) ; annule = tout le reste (canceled, unpaid...)
  const statut = (status === 'active' || status === 'trialing') ? 'actif'
    : status === 'past_due' ? 'impaye'
    : 'annule'
  const enEssai = status === 'trialing'

  const { data: abo } = await supabase
    .from('abonnements_boutique')
    .select('id, beatmaker_id, client_id, statut, acheteur_email, demande_annulation_notifiee')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!abo) return

  // Boutique suspendue depuis l'admin (Étape 15c) — pause_collection ne
  // change PAS subscription.status (reste "active"), donc sans ce garde-fou
  // ce handler écraserait silencieusement 'suspendu' par 'actif' au premier
  // événement Stripe reçu sur l'abonnement (y compris celui déclenché par la
  // pause elle-même), cassant la réactivation qui ne retrouve alors plus
  // rien à traiter. Découvert en testant le 2026-07-24. Le statut ne doit
  // être repris que par reactiverBoutique() (lib/admin-boutiques.ts).
  if (abo.statut === 'suspendu') return

  const entreEnImpaye = statut === 'impaye' && abo.statut !== 'impaye'
  // Moment de la décision de churn (clic "Annuler" côté Business ou
  // self-service client) — l'abo reste actif jusqu'à la fin de la période
  // payée (cancel_at_period_end), Stripe n'enverra subscription.deleted que
  // plus tard. Jake veut le message churn dès la décision, pas à l'échéance
  // réelle (voir traiterAnnulationAbonnement pour le filet des annulations
  // immédiates, ex. abo impaye annulé sans phase de transition).
  //
  // Pas de détection de transition ici (ex. "!abo.annulation_en_cours") : le
  // bouton Business pose annulation_en_cours=true en base de façon synchrone
  // dans sa propre route, avant même que ce webhook n'arrive — une détection
  // par transition ne verrait donc jamais passer ce cas (toujours déjà true à
  // la lecture). On tente l'insertion à chaque webhook où cancel_at_period_end
  // est true ; la contrainte UNIQUE(type, reference_id) sur
  // automatisation_evenements absorbe les tentatives redondantes (même
  // mécanisme que pour abonnement_en_attente).
  const demandeAnnulationProgrammee = subscription.cancel_at_period_end === true

  // Contrairement au churn (ci-dessus), demande_annulation_notifiee n'est
  // écrit QUE par ce webhook — pas de race avec une route synchrone — donc
  // une vraie détection de transition est possible et nécessaire ici (sinon
  // Stripe redéliverait cet email à chaque nouvel événement "updated" reçu
  // tant que l'abo reste en cancel_at_period_end, ex. tout autre changement
  // sur l'abonnement pendant cette période).
  const notifierDemandeAnnulation = demandeAnnulationProgrammee && !abo.demande_annulation_notifiee

  const { error } = await supabase
    .from('abonnements_boutique')
    .update({
      statut,
      en_essai: enEssai,
      // Synchronise le flag même pour l'annulation self-service côté client
      // (/api/stripe/abonnement/annuler), qui ne le mettait jusqu'ici jamais à
      // jour en base — seul le bouton Business le faisait.
      annulation_en_cours: subscription.cancel_at_period_end,
      // Reset dès que l'abo n'est plus en cancel_at_period_end (annulation
      // annulée ou déjà passée) — une future demande d'annulation renverra
      // à nouveau l'email de confirmation.
      demande_annulation_notifiee: demandeAnnulationProgrammee,
      // Ne pose la date que la première fois (pas à chaque relance Stripe tant
      // qu'on reste en impaye) ; la efface si le paiement est finalement repassé.
      ...(entreEnImpaye ? { impaye_depuis: new Date().toISOString() } : {}),
      ...(statut === 'actif' ? { impaye_depuis: null } : {}),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur maj abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement mis à jour:', subscription.id, statut)

  if (entreEnImpaye && abo.client_id && await automatisationActive(abo.beatmaker_id, 'abonnement_en_attente')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: abo.beatmaker_id,
      client_id: abo.client_id,
      type: 'abonnement_en_attente',
      reference_id: abo.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements (impaye):', JSON.stringify(evenementError))
  }

  if (demandeAnnulationProgrammee && abo.client_id && await automatisationActive(abo.beatmaker_id, 'churn_message_perso')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: abo.beatmaker_id,
      client_id: abo.client_id,
      type: 'churn_message_perso',
      reference_id: abo.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements (churn):', JSON.stringify(evenementError))
  }

  // cancel_at_period_end=true ne remplit PAS cancel_at (mécanismes séparés
  // côté Stripe, vérifié le 2026-07-17 — cancel_at sert uniquement à annuler
  // à un timestamp choisi explicitement). La vraie date de fin est
  // current_period_end, déplacé sur l'item dans cette version de l'API (même
  // restructuration que pour invoice.parent.subscription_details, voir
  // traiterPaiementAbonnement) — un seul item par abonnement dans ce modèle.
  const finPeriode = subscription.items.data[0]?.current_period_end
  if (notifierDemandeAnnulation && abo.acheteur_email && finPeriode) {
    // await : sinon la promesse (appel Resend + écriture email_logs) risque de
    // ne jamais finir — c'est la dernière instruction de la fonction, rien
    // après pour laisser le temps au fire-and-forget de compléter avant que
    // Vercel ne gèle l'instance à la réponse du webhook (bug constaté le
    // 2026-07-17 : conditions toutes vraies au diagnostic, mais aucun email
    // ni aucune erreur nulle part).
    await confirmationDemandeAnnulation({
      to: abo.acheteur_email,
      beatmakerId: abo.beatmaker_id,
      clientId: abo.client_id,
      dateFin: new Date(finPeriode * 1000),
    }).catch(err => console.error('[webhook] Erreur envoi email demande annulation:', err))
  }
}

async function traiterAnnulationAbonnement(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()

  const { data: abo } = await supabase
    .from('abonnements_boutique')
    .select('id, beatmaker_id, client_id, acheteur_email, demande_annulation_notifiee')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  const { error } = await supabase
    .from('abonnements_boutique')
    .update({ statut: 'annule', en_essai: false, mois_consecutifs: 0, impaye_depuis: null })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur annulation abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement annulé:', subscription.id)

  // Filet réservé au cas où aucune demande_annulation_abonnement n'a été
  // envoyée avant (ex. abo impayé résilié directement, sans jamais passer
  // par cancel_at_period_end) — sinon le client recevrait 2 emails pour la
  // même annulation, la date étant déjà connue depuis la 1ère confirmation.
  if (abo?.acheteur_email && !abo.demande_annulation_notifiee) {
    await annulationAbonnement({
      to: abo.acheteur_email,
      beatmakerId: abo.beatmaker_id,
      clientId: abo.client_id,
    }).catch(err => console.error('[webhook] Erreur envoi email annulation abonnement:', err))
  }

  // Filet pour les annulations immédiates (ex. abo impaye annulé directement,
  // sans être passé par cancel_at_period_end) — le cas normal (décision
  // d'annuler pendant que l'abo est encore actif) est déjà couvert par
  // traiterMajAbonnement. La contrainte UNIQUE(type, reference_id) sur
  // automatisation_evenements empêche un double envoi si les deux se
  // déclenchent pour le même abo.
  if (abo?.client_id && await automatisationActive(abo.beatmaker_id, 'churn_message_perso')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: abo.beatmaker_id,
      client_id: abo.client_id,
      type: 'churn_message_perso',
      reference_id: abo.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements (churn):', JSON.stringify(evenementError))
  }
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

  const clientId = meta.client_id || await resoudreOuCreerClient(supabase, email, nom)
  if (!clientId) {
    console.error('[webhook] Impossible de résoudre le client pour l\'abonnement, session:', session.id)
    return
  }

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('abo_prix, tva_active, tva_taux')
    .eq('id', meta.beatmaker_id)
    .single()

  const dateDebut = new Date().toISOString()
  const dateFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: abonnement, error } = await supabase.from('abonnements_boutique').insert({
    beatmaker_id: meta.beatmaker_id,
    client_id: clientId,
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
  }).select('id').single()

  if (error) {
    console.error('[webhook] Erreur insert abonnement_boutique:', JSON.stringify(error))
    return
  }

  console.log('[webhook] Abonnement créé:', abonnement?.id)

  if (email) {
    await confirmationAbonnement({
      to: email,
      beatmakerId: meta.beatmaker_id,
      abonnementId: abonnement.id,
      clientId,
    }).catch(err => console.error('[webhook] Erreur envoi email confirmation abonnement:', err))
  }

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
    console.log('[webhook] invoice.payment_succeeded — abonnement boutique non trouvé:', subscriptionId)
    return
  }

  const typeCommande = billing === 'subscription_create' ? 'CREATION_ABONNEMENT' : 'RENOUVELLEMENT'
  const montantCents = invoice.amount_paid ?? 0
  const prixPaye = montantCents / 100
  const invoiceId = invoice.id

  // Éviter les doublons si le webhook est rejoué (clé d'idempotence = invoice.id)
  const { data: existing } = await supabase
    .from('commandes')
    .select('id')
    .eq('plateforme_source', 'my_producer')
    .eq('external_order_id', invoiceId)
    .maybeSingle()
  if (existing) {
    console.log('[webhook] Paiement abo déjà enregistré:', invoiceId)
    return
  }

  const { error } = await supabase.from('commandes').insert({
    client_id: abo.client_id,
    beatmaker_id: abo.beatmaker_id,
    prix_paye: prixPaye,
    methode_paiement: 'stripe',
    statut: 'payee',
    plateforme_source: 'my_producer',
    external_order_id: invoiceId,
    type_commande: typeCommande,
    // Pas de contrat PDF / fichier pour une commande d'abonnement — toujours
    // "livrée" dès la création, aucune opération asynchrone à suivre ici.
    fichiers_livres: true,
    statut_livraison: 'livree',
    // Taux figé à la souscription (TVA toujours absorbée) — jamais le taux
    // actuel du beatmaker, qui a pu changer depuis pour d'autres abonnés.
    tva_taux: abo.tva_taux,
    source_marketing: abo.source_marketing ?? 'direct',
  })

  if (error) {
    console.error('[webhook] Erreur insert commande abo:', JSON.stringify(error))
    return
  }

  // Incrémenter mensualites_payees (total facturé) et mois_consecutifs (compteur
  // de fidélité vers le beat cadeau — remis à 0 uniquement sur annulation, pas
  // sur un simple impayé temporaire : un paiement qui repasse pendant la
  // période de grâce ne fait donc pas "repartir de zéro")
  const { data: aboActuel } = await supabase
    .from('abonnements_boutique')
    .select('mensualites_payees, mois_consecutifs')
    .eq('id', abo.id)
    .single()
  await supabase
    .from('abonnements_boutique')
    .update({
      mensualites_payees: (aboActuel?.mensualites_payees ?? 0) + 1,
      mois_consecutifs: (aboActuel?.mois_consecutifs ?? 0) + 1,
      impaye_depuis: null,
    })
    .eq('id', abo.id)

  console.log('[webhook]', typeCommande, '— commande créée, mensualites_payees incrémenté pour abo', abo.id)
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

  const { data: abo } = await supabase
    .from('abonnements_boutique')
    .select('id, beatmaker_id, client_id, acheteur_email, source_marketing')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (abo) {
    const { error } = await supabase.from('tentatives_paiement').upsert({
      type: 'renouvellement_abonnement',
      beatmaker_id: abo.beatmaker_id,
      abonnement_id: abo.id,
      client_id: abo.client_id,
      email: abo.acheteur_email,
      prix: (invoice.amount_due ?? 0) / 100,
      source_marketing: abo.source_marketing,
      stripe_invoice_id: invoice.id,
      statut: 'echouee',
    }, { onConflict: 'stripe_invoice_id' })

    if (error) console.error('[webhook] Erreur insert tentative renouvellement:', JSON.stringify(error))
    else console.log('[webhook] Échec de renouvellement tracé pour abo', abo.id)
    return
  }

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

async function traiterCompteConnecte(account: Stripe.Account) {
  // Déclenché quand un beatmaker connecte son compte Stripe (payouts_enabled → true)
  if (!account.payouts_enabled) return

  const supabase = createAdminClient()

  // Retrouver le beatmaker via son stripe_account_id
  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id, email')
    .eq('stripe_account_id', account.id)
    .maybeSingle()

  if (!beatmaker) {
    console.log('[webhook] account.updated — beatmaker non trouvé pour', account.id)
    return
  }

  // Lier les beat_splits en attente par email_invite si pas encore liés
  if (account.email || beatmaker.email) {
    const email = account.email ?? beatmaker.email
    await supabase
      .from('beat_splits')
      .update({ beatmaker_id: beatmaker.id, statut: 'actif', email_invite: null })
      .eq('email_invite', email)
      .is('beatmaker_id', null)
    console.log('[webhook] beat_splits liés pour', email)
  }

  // Récupérer tous ses split_payments en attente (par beatmaker_id OU email_invite)
  // `commandes` n'a plus de relation directe vers `beats` depuis le passage
  // au panier multi-articles (Phase 2c) — le titre passe par beat_split_id →
  // beat_splits → beats. Bug trouvé en testant F4 (audit 2026-07-29) : cassait
  // silencieusement tout déblocage automatique à la connexion Stripe depuis
  // le 2026-07-09 (relation inexistante → requête en erreur → traité comme
  // "aucun split en attente" sans jamais logger l'erreur réelle).
  const { data: pendingByBeatmakerId, error: errBeatmakerId } = await supabase
    .from('split_payments')
    .select('id, montant, commandes(stripe_transfer_group), beat_splits(beats(titre))')
    .eq('beatmaker_id', beatmaker.id)
    .eq('statut', 'en_attente')
  if (errBeatmakerId) console.error('[webhook] Erreur lecture pendingByBeatmakerId:', errBeatmakerId.message)

  const { data: pendingByEmail, error: errEmail } = account.email ? await supabase
    .from('split_payments')
    .select('id, montant, email_invite, commandes(stripe_transfer_group), beat_splits(beats(titre))')
    .eq('email_invite', account.email)
    .eq('statut', 'en_attente') : { data: [], error: null }
  if (errEmail) console.error('[webhook] Erreur lecture pendingByEmail:', errEmail.message)

  type PendingSplit = {
    id: string
    montant: number
    email_invite?: string | null
    commandes: { stripe_transfer_group: string | null } | null
    beat_splits: { beats: { titre: string } | null } | null
  }

  const pending = [
    ...((pendingByBeatmakerId ?? []) as unknown as PendingSplit[]),
    ...((pendingByEmail ?? []) as unknown as PendingSplit[]),
  ]

  if (pending.length === 0) {
    console.log('[webhook] Aucun split en attente pour', beatmaker.id)
    return
  }

  console.log('[webhook] Déblocage de', pending.length, 'splits pour', beatmaker.id)

  for (const sp of pending) {
    const transferGroup = sp.commandes?.stripe_transfer_group
    const titreBeat = sp.beat_splits?.beats?.titre ?? 'Beat'
    if (!transferGroup) continue

    try {
      const transfer = await stripe.transfers.create({
        amount: sp.montant,
        currency: 'eur',
        destination: account.id,
        transfer_group: transferGroup,
        description: `Déblocage split — ${titreBeat} — sp ${sp.id}`,
      })

      await supabase
        .from('split_payments')
        .update({
          statut: 'transfere',
          stripe_transfer_id: transfer.id,
          // Si c'était un email_invite, mettre à jour beatmaker_id
          beatmaker_id: beatmaker.id,
          email_invite: null,
        })
        .eq('id', sp.id)

      console.log('[webhook] Transfer débloqué:', transfer.id, 'pour sp', sp.id)
    } catch (err) {
      console.error('[webhook] Erreur déblocage split', sp.id, ':', err)
    }
  }
}
