import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

  // Annule la résiliation programmée — le webhook customer.subscription.updated
  // synchronise annulation_en_cours=false en base (voir traiterMajAbonnement).
  await stripe.subscriptions.update(subscription_id, { cancel_at_period_end: false })

  return NextResponse.json({ ok: true })
}
