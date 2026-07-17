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

  // Vérifier l'identité — session Supabase en priorité, cookie en fallback
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let aboQuery = admin
    .from('abonnements_boutique')
    .select('id, stripe_subscription_id, acheteur_email')
    .eq('stripe_subscription_id', subscription_id)

  let abo = null

  if (user) {
    const { data } = await aboQuery
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
      .select('id, stripe_subscription_id, acheteur_email')
      .eq('stripe_subscription_id', subscription_id)
      .eq('acheteur_email', emailCookie)
      .single()
    abo = data
  }

  if (!abo) {
    return NextResponse.json({ erreur: 'Abonnement introuvable' }, { status: 404 })
  }

  // Annuler à la fin de la période (cancel_at_period_end)
  try {
    await stripe.subscriptions.update(subscription_id, { cancel_at_period_end: true })
  } catch (err) {
    console.error('[abonnement/annuler] Erreur Stripe:', err)
    const message = err instanceof Error ? err.message : 'Erreur Stripe inconnue'
    return NextResponse.json({ erreur: message }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
