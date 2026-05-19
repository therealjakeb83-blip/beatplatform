import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { genererContratPdf } from '@/lib/contrat'
import { uploadPdfContrat } from '@/lib/livraison'
import { envoyerFondsEnAttente } from '@/lib/emails'
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
    await traiterPaiement(event.data.object as Stripe.Checkout.Session)
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

  return NextResponse.json({ ok: true })
}

async function traiterMajAbonnement(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const status = subscription.status
  // actif = active ou trialing
  const statut = (status === 'active' || status === 'trialing') ? 'actif' : 'annule'
  const enEssai = status === 'trialing'

  const { error } = await supabase
    .from('abonnements_boutique')
    .update({ statut, en_essai: enEssai })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur maj abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement mis à jour:', subscription.id, statut)
}

async function traiterAnnulationAbonnement(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('abonnements_boutique')
    .update({ statut: 'annule', en_essai: false })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur annulation abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement annulé:', subscription.id)
}

async function traiterPaiement(session: Stripe.Checkout.Session) {
  const meta = session.metadata
  if (!meta?.beat_id || !meta?.licence_id || !meta?.beatmaker_id) return

  const acheteurEmail = session.customer_details?.email ?? null
  const acheteurNom = session.customer_details?.name ?? null
  const totalCents = session.amount_total ?? 0
  const prixPaye = Math.round(totalCents / 100)
  const stripePaymentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null)
  const hasSplits = meta.has_splits === 'true'
  const transferGroup = meta.transfer_group ?? null

  const discounts = session.total_details?.breakdown?.discounts ?? []
  const premierDiscount = discounts[0]
  const reduction = premierDiscount ? Math.round(premierDiscount.amount / 100) : 0
  const discountObj = premierDiscount?.discount as unknown as { promotion_code?: { code?: string } | null }
  const promoCode = discountObj?.promotion_code?.code ?? null

  const supabase = createAdminClient()

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
    splits_snapshot: splitsSnapshot,
    stripe_transfer_group: hasSplits ? transferGroup : null,
  }).select('id').single()

  if (error) {
    console.error('[webhook] Erreur insert commande:', JSON.stringify(error))
    return
  }

  console.log('[webhook] Commande créée:', commande?.id)

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
        envoyerFondsEnAttente({ to: split.email_invite, titreBeat, montantEuros }).catch(() => {})
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
