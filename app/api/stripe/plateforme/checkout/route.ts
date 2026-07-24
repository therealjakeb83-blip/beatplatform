import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Étape 8b — Abonnement plateforme (beatmaker → My Producer). Contrairement
// à /api/stripe/abonnement/checkout (artiste → boutique d'un beatmaker), pas
// de Stripe Connect ici : le paiement va directement sur le compte principal,
// c'est le beatmaker lui-même qui paie. Essai 14 jours + carte obligatoire
// dès l'inscription (comportement par défaut de Checkout avec
// trial_period_days — la carte est collectée immédiatement).
export async function POST(request: Request) {
  const { periode } = await request.json()
  if (periode !== 'mensuel' && periode !== 'annuel') {
    return NextResponse.json({ erreur: 'Période invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id, email')
    .eq('id', user.id)
    .single()
  if (!beatmaker) return NextResponse.json({ erreur: 'Compte beatmaker introuvable' }, { status: 404 })

  const priceId = periode === 'mensuel'
    ? process.env.STRIPE_PRICE_PLATEFORME_MENSUEL
    : process.env.STRIPE_PRICE_PLATEFORME_ANNUEL
  if (!priceId) return NextResponse.json({ erreur: 'Configuration Stripe manquante' }, { status: 500 })

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: beatmaker.email,
    line_items: [{ price: priceId, quantity: 1 }],
    billing_address_collection: 'required',
    subscription_data: {
      trial_period_days: 14,
      metadata: { beatmaker_id: beatmaker.id, type: 'abonnement_plateforme', periode },
    },
    success_url: `${origin}/dashboard/abonnement?succes=1`,
    cancel_url: `${origin}/dashboard/abonnement`,
    metadata: { beatmaker_id: beatmaker.id, type: 'abonnement_plateforme', periode },
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  return NextResponse.json({ url: session.url })
}
