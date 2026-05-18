import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { genererContratPdf } from '@/lib/contrat'
import { uploadPdfContrat } from '@/lib/livraison'
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
  const prixPaye = Math.round((session.amount_total ?? 0) / 100)
  const stripePaymentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null)

  const discounts = session.total_details?.breakdown?.discounts ?? []
  const premierDiscount = discounts[0]
  const reduction = premierDiscount ? Math.round(premierDiscount.amount / 100) : 0
  const discountObj = premierDiscount?.discount as unknown as { promotion_code?: { code?: string } | null }
  const promoCode = discountObj?.promotion_code?.code ?? null

  const supabase = createAdminClient()

  // Récupérer les splits du beat pour le snapshot
  const { data: splits } = await supabase
    .from('beat_splits')
    .select('pourcentage, beatmaker_id, email_invite, beatmakers(nom_artiste, email)')
    .eq('beat_id', meta.beat_id)

  type SplitRow = {
    pourcentage: number
    beatmaker_id: string | null
    email_invite: string | null
    beatmakers: { nom_artiste: string; email: string } | null
  }

  // Si pas de splits définis, le beatmaker principal = 100%
  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('nom_artiste, email')
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
  }).select('id').single()

  if (error) {
    console.error('[webhook] Erreur insert commande:', JSON.stringify(error))
    return
  }

  console.log('[webhook] Commande créée:', commande?.id)

  // Générer le contrat PDF
  try {
    const { data: beat } = await supabase
      .from('beats')
      .select('titre, bpm, cle')
      .eq('id', meta.beat_id)
      .single()

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
