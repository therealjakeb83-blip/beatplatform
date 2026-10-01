import { stripe } from '@/lib/stripe'
import { assurerConfigurationPortail, optionsCompteAbonnement } from '@/lib/abonnement-boutique'
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
      .select('id, stripe_subscription_id, stripe_account_id')
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
      .select('id, stripe_subscription_id, stripe_account_id')
      .eq('stripe_subscription_id', subscription_id)
      .eq('acheteur_email', emailCookie)
      .single()
    abo = data
  }

  if (!abo) {
    return NextResponse.json({ erreur: 'Abonnement introuvable' }, { status: 404 })
  }

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  try {
    // Le client Stripe de l'abonné vit sur le même compte que l'abonnement
    // (celui du beatmaker depuis le paiement direct).
    const options = optionsCompteAbonnement(abo.stripe_account_id)
    const subscription = await stripe.subscriptions.retrieve(subscription_id, {}, options)
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    const configuration = abo.stripe_account_id ? await assurerConfigurationPortail(abo.stripe_account_id) : undefined
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/${slug}/mon-abonnement`,
      ...(configuration ? { configuration } : {}),
    }, options)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[abonnement/portail] Erreur création session:', err instanceof Error ? err.message : err)
    return NextResponse.json({ erreur: 'La page de changement de carte n\'a pas pu s\'ouvrir, réessaie dans quelques instants.' }, { status: 500 })
  }
}
