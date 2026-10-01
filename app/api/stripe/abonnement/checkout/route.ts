import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { resoudreClientId } from '@/lib/pricing'
import { normaliserEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { slug, source_marketing } = await request.json()
  if (!slug) return NextResponse.json({ erreur: 'slug manquant' }, { status: 400 })

  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()

  const supabase = createAdminClient()
  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id, nom_artiste, abo_actif, abo_prix, abo_nom, stripe_price_id, stripe_account_id')
    .eq('slug', slug)
    .single()

  if (!beatmaker?.abo_actif || !beatmaker.stripe_price_id) {
    return NextResponse.json({ erreur: 'Abonnements non disponibles' }, { status: 404 })
  }

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  // Un beatmaker connecté n'a pas de fiche clients : son id ne peut pas servir
  // de client_id (clé étrangère refusée → abonnement payé jamais enregistré,
  // bug du 2026-09-28). Il est alors rattaché par l'email de son compte.
  const clientId = await resoudreClientId(supabase, user)
  const emailCompte = user?.email ? normaliserEmail(user.email) : null

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: beatmaker.stripe_price_id, quantity: 1 }],
    billing_address_collection: 'required',
    // Le compte connecté prime : son email est imposé chez Stripe, jamais redemandé.
    ...(emailCompte ? { customer_email: emailCompte } : {}),
    subscription_data: {
      metadata: { beatmaker_id: beatmaker.id, slug },
    },
    success_url: `${origin}/api/stripe/abonnement/succes?session_id={CHECKOUT_SESSION_ID}&slug=${slug}`,
    cancel_url: `${origin}/${slug}/abonnement`,
    metadata: {
      beatmaker_id: beatmaker.id, slug, type: 'abonnement_boutique',
      client_id: clientId ?? '', client_email: emailCompte ?? '',
      source_marketing: source_marketing ?? 'direct',
    },
  }

  if (beatmaker.stripe_account_id) {
    sessionParams.subscription_data!.transfer_data = {
      destination: beatmaker.stripe_account_id,
    }
    sessionParams.subscription_data!.application_fee_percent = 0
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  return NextResponse.json({ url: session.url })
}
