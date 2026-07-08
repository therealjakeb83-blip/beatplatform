import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { genererContratPdf } from '@/lib/contrat'
import { uploadPdfContrat } from '@/lib/livraison'
import { envoyerFondsEnAttente } from '@/lib/emails'
import { enregistrerConversionParClic } from '@/lib/mailing'
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.mode === 'subscription') {
      await traiterAbonnementCree(session)
    } else {
      await traiterPaiement(session)
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    await traiterPaiementAbonnement(event.data.object as Stripe.Invoice)
  }

  if (event.type === 'invoice.payment_failed') {
    await traiterEchecRenouvellementAbonnement(event.data.object as Stripe.Invoice)
  }

  if (event.type === 'customer.subscription.updated') {
    await traiterMajAbonnement(event.data.object as Stripe.Subscription)
  }

  if (event.type === 'customer.subscription.deleted') {
    await traiterAnnulationAbonnement(event.data.object as Stripe.Subscription)
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

  return NextResponse.json({ ok: true })
}

async function resoudreClientParEmail(supabase: ReturnType<typeof createAdminClient>, email: string | null) {
  if (!email) return null
  const { data: client } = await supabase.from('clients').select('id').eq('email', email).maybeSingle()
  return client?.id ?? null
}

// Vérifie que l'automatisation est activée avant même de déposer l'événement
// dans la file d'attente — un beatmaker qui n'a jamais activé une recette ne
// doit rien y voir apparaître (choix produit de Jake, 2026-07-08).
async function automatisationActive(
  supabase: ReturnType<typeof createAdminClient>,
  beatmakerId: string,
  type: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('automatisations')
    .select('actif')
    .eq('beatmaker_id', beatmakerId)
    .eq('type', type)
    .maybeSingle()
  return data?.actif ?? false
}

// Résolution client par email — crée un compte invité si inconnu (contrairement
// à resoudreClientParEmail qui ne fait que chercher, sans créer)
async function resoudreOuCreerClient(
  supabase: ReturnType<typeof createAdminClient>,
  email: string | null,
  nom: string | null,
): Promise<string | null> {
  if (!email) return null

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingClient) return existingClient.id

  const parts = (nom ?? '').trim().split(' ')
  const prenom = parts[0] || null
  const nomFamille = parts.slice(1).join(' ') || parts[0] || email.split('@')[0]
  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert({ id: crypto.randomUUID(), email, nom: nomFamille, prenom })
    .select('id')
    .single()
  if (clientError) console.error('[webhook] Erreur insert client invité:', JSON.stringify(clientError))
  return newClient?.id ?? null
}

async function traiterExpirationTentative(session: Stripe.Checkout.Session) {
  const supabase = createAdminClient()
  const email = session.customer_details?.email ?? null
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
  const email = session.customer_details?.email ?? null
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
    .select('id, beatmaker_id, client_id, statut')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!abo) return

  const entreEnImpaye = statut === 'impaye' && abo.statut !== 'impaye'

  const { error } = await supabase
    .from('abonnements_boutique')
    .update({
      statut,
      en_essai: enEssai,
      // Ne pose la date que la première fois (pas à chaque relance Stripe tant
      // qu'on reste en impaye) ; la efface si le paiement est finalement repassé.
      ...(entreEnImpaye ? { impaye_depuis: new Date().toISOString() } : {}),
      ...(statut === 'actif' ? { impaye_depuis: null } : {}),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur maj abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement mis à jour:', subscription.id, statut)

  if (entreEnImpaye && abo.client_id && await automatisationActive(supabase, abo.beatmaker_id, 'abonnement_en_attente')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: abo.beatmaker_id,
      client_id: abo.client_id,
      type: 'abonnement_en_attente',
      reference_id: abo.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements (impaye):', JSON.stringify(evenementError))
  }
}

async function traiterAnnulationAbonnement(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('abonnements_boutique')
    .update({ statut: 'annule', en_essai: false, mois_consecutifs: 0, impaye_depuis: null })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur annulation abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement annulé:', subscription.id)
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

  const email = session.customer_details?.email ?? null
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
    .select('abo_prix')
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

  if (await automatisationActive(supabase, meta.beatmaker_id, 'bienvenue_abonnement')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: meta.beatmaker_id,
      client_id: clientId,
      type: 'bienvenue_abonnement',
      reference_id: abonnement.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
  }
}

async function traiterPaiement(session: Stripe.Checkout.Session) {
  const meta = session.metadata
  if (!meta?.beat_id || !meta?.licence_id || !meta?.beatmaker_id) return

  const acheteurEmail = session.customer_details?.email ?? null
  const acheteurNom = session.customer_details?.name ?? null
  const totalCents = session.amount_total ?? 0
  const prixPaye = totalCents / 100
  const stripePaymentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null)
  const hasSplits = meta.has_splits === 'true'
  const transferGroup = meta.transfer_group ?? null

  // Code promo appliqué côté serveur avant checkout — lu depuis les métadonnées
  const promoCode = meta.code_promo ?? null
  const reduction = meta.reduction_code_promo ? Number(meta.reduction_code_promo) / 100 : 0

  const supabase = createAdminClient()

  const clientId = await resoudreOuCreerClient(supabase, acheteurEmail, acheteurNom)

  // Récupérer les infos du beat (titre nécessaire pour les emails de fonds en attente)
  const { data: beat } = await supabase
    .from('beats')
    .select('titre, bpm, cle')
    .eq('id', meta.beat_id)
    .single()

  // Récupérer les splits du beat (avec stripe_account_id pour les transfers)
  const { data: splits } = await supabase
    .from('beat_splits')
    .select('id, pourcentage, beatmaker_id, email_invite, beatmakers(nom_artiste, email, stripe_account_id)')
    .eq('beat_id', meta.beat_id)

  type SplitRow = {
    id: string
    pourcentage: number
    beatmaker_id: string | null
    email_invite: string | null
    beatmakers: { nom_artiste: string; email: string; stripe_account_id: string | null } | null
  }

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('nom_artiste, email, stripe_account_id')
    .eq('id', meta.beatmaker_id)
    .single()

  let splitsSnapshot: { nom_artiste: string; pourcentage: number; email?: string }[]

  if (!splits || splits.length === 0) {
    splitsSnapshot = [{ nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker', pourcentage: 100, email: beatmaker?.email }]
  } else {
    splitsSnapshot = (splits as unknown as SplitRow[]).map(s => ({
      nom_artiste: s.beatmakers?.nom_artiste ?? s.email_invite ?? 'Collab',
      pourcentage: s.pourcentage,
      email: s.beatmakers?.email ?? s.email_invite ?? undefined,
    }))
  }

  // Créer la commande
  const { data: commande, error } = await supabase.from('commandes').insert({
    client_id: clientId,
    beatmaker_id: meta.beatmaker_id,
    beat_id: meta.beat_id,
    licence_id: meta.licence_id,
    acheteur_email: acheteurEmail,
    acheteur_nom: acheteurNom,
    prix_paye: prixPaye,
    devise: 'EUR',
    methode_paiement: 'stripe',
    stripe_payment_id: stripePaymentId,
    stripe_session_id: session.id,
    statut: 'payee',
    code_promo: promoCode,
    reduction_montant: reduction,
    fichiers_livres: false,
    plateforme_source: 'my_producer',
    source_marketing: meta.source_marketing ?? 'direct',
    type_commande: 'LICENCE',
    splits_snapshot: splitsSnapshot,
    stripe_transfer_group: hasSplits ? transferGroup : null,
  }).select('id').single()

  if (error) {
    console.error('[webhook] Erreur insert commande:', JSON.stringify(error))
    return
  }

  console.log('[webhook] Commande créée:', commande?.id)

  // Marquer la tentative de paiement correspondante comme complète
  if (commande) {
    const { error: tentativeError } = await supabase
      .from('tentatives_paiement')
      .update({ statut: 'complete', commande_id: commande.id, client_id: clientId, email: acheteurEmail })
      .eq('stripe_session_id', session.id)
    if (tentativeError) console.error('[webhook] Erreur maj tentative_paiement:', JSON.stringify(tentativeError))
  }

  // Attribution marketing : exige à la fois un clic récent sur la campagne (cookie posé
  // par /api/marketing/clic) ET que l'achat soit fait avec le même client que le
  // destinataire — pour que la conversion reste cohérente avec la fiche client
  // (sinon la commande et la conversion se retrouvent sur deux clients différents).
  // Purement statistique, ne doit jamais faire échouer le paiement.
  if (meta.campagne_id && meta.campagne_client_id && meta.campagne_client_id === clientId) {
    enregistrerConversionParClic(meta.campagne_id, meta.campagne_client_id).catch(err =>
      console.error('[webhook] Erreur enregistrement conversion campagne:', err)
    )
  }

  // Incrémenter le compteur d'utilisations du code promo
  if (promoCode) {
    const { data: codePromoData } = await supabase
      .from('codes_promo')
      .select('id, utilisations')
      .eq('beatmaker_id', meta.beatmaker_id)
      .eq('code', promoCode)
      .maybeSingle()
    if (codePromoData) {
      await supabase
        .from('codes_promo')
        .update({ utilisations: codePromoData.utilisations + 1 })
        .eq('id', codePromoData.id)
    }
  }

  // Créer un lead pour ce beatmaker si le client n'en a pas déjà un
  if (clientId) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('client_id', clientId)
      .eq('beatmaker_id', meta.beatmaker_id)
      .maybeSingle()

    if (!existingLead) {
      const { error: leadError } = await supabase.from('leads').insert({
        client_id:          clientId,
        beatmaker_id:       meta.beatmaker_id,
        source:             'visite',
        newsletter_inscrit: false,
      })
      if (leadError) console.error('[webhook] Erreur insert lead:', JSON.stringify(leadError))
    }
  }

  // Distribuer les fonds entre collaborateurs (si le beat a des splits)
  if (hasSplits && transferGroup && splits && splits.length > 0 && commande) {
    await distribuerSplits({
      supabase,
      splits: splits as unknown as SplitRow[],
      beatmaker,
      commandeId: commande.id,
      beatmakerId: meta.beatmaker_id,
      totalCents,
      transferGroup,
      titreBeat: beat?.titre ?? 'Beat',
    })
  }

  // Générer le contrat PDF
  try {
    const { data: licence } = await supabase
      .from('licences')
      .select('nom')
      .eq('id', meta.licence_id)
      .single()

    if (beat && licence && commande) {
      const pdfBytes = await genererContratPdf({
        beat: { titre: beat.titre, bpm: beat.bpm, cle: beat.cle },
        beatmaker: { nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker' },
        acheteur: { nom: acheteurNom, email: acheteurEmail },
        licence: { nom: licence.nom },
        splits: splitsSnapshot,
        dateVente: new Date(),
      })

      const pdfUrl = await uploadPdfContrat(commande.id, pdfBytes)

      await supabase
        .from('commandes')
        .update({ contrat_pdf_url: pdfUrl, fichiers_livres: true })
        .eq('id', commande.id)

      console.log('[webhook] Contrat PDF généré:', pdfUrl)
    }
  } catch (err) {
    console.error('[webhook] Erreur génération PDF:', err)
  }
}

type SplitRow = {
  id: string
  pourcentage: number
  beatmaker_id: string | null
  email_invite: string | null
  beatmakers: { nom_artiste: string; email: string; stripe_account_id: string | null } | null
}

async function distribuerSplits({
  supabase,
  splits,
  beatmaker,
  commandeId,
  beatmakerId,
  totalCents,
  transferGroup,
  titreBeat,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  splits: SplitRow[]
  beatmaker: { nom_artiste: string; email: string; stripe_account_id: string | null } | null
  commandeId: string
  beatmakerId: string
  totalCents: number
  transferGroup: string
  titreBeat: string
}) {
  const splitPayments: Record<string, unknown>[] = []
  let montantProprioCents = totalCents

  for (const split of splits) {
    const montantCents = Math.round(totalCents * split.pourcentage / 100)
    montantProprioCents -= montantCents

    if (split.beatmaker_id && split.beatmakers?.stripe_account_id) {
      // Collab inscrit avec compte Stripe → transfer immédiat
      let stripeTransferId: string | null = null
      try {
        const transfer = await stripe.transfers.create({
          amount: montantCents,
          currency: 'eur',
          destination: split.beatmakers.stripe_account_id,
          transfer_group: transferGroup,
          description: `Split ${split.pourcentage}% — ${titreBeat} — commande ${commandeId}`,
        })
        stripeTransferId = transfer.id
        console.log('[webhook] Transfer créé:', transfer.id, 'pour', split.beatmakers.nom_artiste)
      } catch (err) {
        console.error('[webhook] Erreur transfer collab:', err)
      }
      splitPayments.push({
        commande_id: commandeId,
        beat_split_id: split.id,
        beatmaker_id: split.beatmaker_id,
        email_invite: null,
        montant: montantCents,
        stripe_transfer_id: stripeTransferId,
        statut: stripeTransferId ? 'transfere' : 'en_attente',
      })
    } else {
      // Collab non inscrit → fonds en attente + email
      splitPayments.push({
        commande_id: commandeId,
        beat_split_id: split.id,
        beatmaker_id: null,
        email_invite: split.email_invite,
        montant: montantCents,
        stripe_transfer_id: null,
        statut: 'en_attente',
      })
      if (split.email_invite) {
        const montantEuros = (montantCents / 100).toFixed(2)
        envoyerFondsEnAttente({ to: split.email_invite, titreBeat, montantEuros, beatmakerId }).catch(() => {})
      }
    }
  }

  // Part du propriétaire du beat
  if (montantProprioCents > 0 && beatmaker?.stripe_account_id) {
    let stripeTransferId: string | null = null
    try {
      const transfer = await stripe.transfers.create({
        amount: montantProprioCents,
        currency: 'eur',
        destination: beatmaker.stripe_account_id,
        transfer_group: transferGroup,
        description: `Part propriétaire — ${titreBeat} — commande ${commandeId}`,
      })
      stripeTransferId = transfer.id
      console.log('[webhook] Transfer propriétaire créé:', transfer.id)
    } catch (err) {
      console.error('[webhook] Erreur transfer propriétaire:', err)
    }
    splitPayments.push({
      commande_id: commandeId,
      beat_split_id: null,
      beatmaker_id: beatmakerId,
      email_invite: null,
      montant: montantProprioCents,
      stripe_transfer_id: stripeTransferId,
      statut: stripeTransferId ? 'transfere' : 'en_attente',
    })
  }

  if (splitPayments.length) {
    const { error } = await supabase.from('split_payments').insert(splitPayments)
    if (error) console.error('[webhook] Erreur insert split_payments:', JSON.stringify(error))
    else console.log('[webhook] split_payments insérés:', splitPayments.length)
  }
}

type AboLookup = { id: string; client_id: string | null; beatmaker_id: string; prix: number; source_marketing: string | null }

async function attendreAbonnement(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  tentatives = 5,
  delaiMs = 1500,
): Promise<AboLookup | null> {
  for (let i = 0; i < tentatives; i++) {
    const { data: abo } = await supabase
      .from('abonnements_boutique')
      .select('id, client_id, beatmaker_id, prix, source_marketing')
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
    beat_id: null,
    licence_id: null,
    prix_paye: prixPaye,
    devise: 'EUR',
    methode_paiement: 'stripe',
    statut: 'payee',
    plateforme_source: 'my_producer',
    external_order_id: invoiceId,
    type_commande: typeCommande,
    fichiers_livres: true,
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

  if (!abo) {
    console.log('[webhook] invoice.payment_failed — abonnement boutique non trouvé:', subscriptionId)
    return
  }

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
  const emailCondition = account.email ? `.eq('email_invite', '${account.email}')` : ''
  void emailCondition

  const { data: pendingByBeatmakerId } = await supabase
    .from('split_payments')
    .select('id, montant, commandes(stripe_transfer_group, beats(titre))')
    .eq('beatmaker_id', beatmaker.id)
    .eq('statut', 'en_attente')

  const { data: pendingByEmail } = account.email ? await supabase
    .from('split_payments')
    .select('id, montant, email_invite, commandes(stripe_transfer_group, beats(titre))')
    .eq('email_invite', account.email)
    .eq('statut', 'en_attente') : { data: [] }

  type PendingSplit = {
    id: string
    montant: number
    email_invite?: string | null
    commandes: { stripe_transfer_group: string | null; beats: { titre: string } | null } | null
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
    const titreBeat = sp.commandes?.beats?.titre ?? 'Beat'
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
