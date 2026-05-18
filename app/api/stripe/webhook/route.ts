import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
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

  return NextResponse.json({ ok: true })
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

  const { error } = await supabase.from('commandes').insert({
    beatmaker_id: meta.beatmaker_id,
    beat_id: meta.beat_id,
    licence_id: meta.licence_id,
    acheteur_email: acheteurEmail,
    acheteur_nom: acheteurNom,
    prix_paye: prixPaye,
    devise: 'EUR',
    methode_paiement: 'stripe',
    stripe_payment_id: stripePaymentId,
    statut: 'payee',
    code_promo: promoCode,
    reduction_montant: reduction,
    fichiers_livres: false,
    plateforme_source: 'my_producer',
  })

  if (error) {
    console.error('[webhook] Erreur insert commande:', JSON.stringify(error))
  } else {
    console.log('[webhook] Commande créée pour beat', meta.beat_id)
  }
}
