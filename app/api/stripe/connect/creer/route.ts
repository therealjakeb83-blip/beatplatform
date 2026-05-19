import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id, email, nom_artiste')
    .eq('id', user.id)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Beatmaker introuvable' }, { status: 404 })

  let accountId = beatmaker.stripe_account_id

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: beatmaker.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { beatmaker_id: user.id },
    })
    accountId = account.id

    await supabase
      .from('beatmakers')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id)
  }

  // Lier les beat_splits en attente par email_invite dès la connexion Stripe
  await supabase
    .from('beat_splits')
    .update({ beatmaker_id: user.id, statut: 'actif', email_invite: null })
    .eq('email_invite', beatmaker.email)
    .is('beatmaker_id', null)

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/paiements?refresh=true`,
    return_url: `${origin}/dashboard/paiements?connected=true`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: accountLink.url })
}
