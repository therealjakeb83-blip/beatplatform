import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { subscription_id, slug } = await request.json()

  if (!subscription_id || !slug) {
    return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })
  }

  // Vérifier que le cookie correspond bien à cet abonnement
  const cookieStore = await cookies()
  const emailCookie = cookieStore.get(`abo_${slug}`)?.value
  if (!emailCookie) {
    return NextResponse.json({ erreur: 'Session membre introuvable' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: abo } = await admin
    .from('abonnements_boutique')
    .select('id, stripe_subscription_id, acheteur_email')
    .eq('stripe_subscription_id', subscription_id)
    .eq('acheteur_email', emailCookie)
    .single()

  if (!abo) {
    return NextResponse.json({ erreur: 'Abonnement introuvable' }, { status: 404 })
  }

  // Annuler à la fin de la période (cancel_at_period_end)
  await stripe.subscriptions.update(subscription_id, { cancel_at_period_end: true })

  return NextResponse.json({ ok: true })
}
