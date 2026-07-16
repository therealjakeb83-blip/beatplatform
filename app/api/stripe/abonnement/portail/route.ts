import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { subscription_id, slug } = await request.json()

  if (!subscription_id || !slug) {
    return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Vérifier l'identité — même logique que /api/stripe/abonnement/annuler
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let abo = null

  if (user) {
    const { data } = await admin
      .from('abonnements_boutique')
      .select('id, stripe_subscription_id')
      .eq('stripe_subscription_id', subscription_id)
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .single()
    abo = data
  }

  if (!abo) {
    const cookieStore = await cookies()
    const emailCookie = cookieStore.get(`abo_${slug}`)?.value
    if (!emailCookie) {
      return NextResponse.json({ erreur: 'Session membre introuvable' }, { status: 401 })
    }
    const { data } = await admin
      .from('abonnements_boutique')
      .select('id, stripe_subscription_id')
      .eq('stripe_subscription_id', subscription_id)
      .eq('acheteur_email', emailCookie)
      .single()
    abo = data
  }

  if (!abo) {
    return NextResponse.json({ erreur: 'Abonnement introuvable' }, { status: 404 })
  }

  const subscription = await stripe.subscriptions.retrieve(subscription_id)
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/${slug}/mon-abonnement`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[abonnement/portail] Erreur création session:', err)
    return NextResponse.json({ erreur: "Le portail de paiement n'est pas encore configuré — contacte le support." }, { status: 500 })
  }
}
