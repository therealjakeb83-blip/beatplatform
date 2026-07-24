import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: abo } = await admin
    .from('abonnements_plateforme')
    .select('stripe_customer_id')
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!abo?.stripe_customer_id) {
    return NextResponse.json({ erreur: 'Aucun abonnement trouvé' }, { status: 404 })
  }

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: abo.stripe_customer_id,
      return_url: `${origin}/dashboard/abonnement`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[plateforme/portail] Erreur création session:', err)
    return NextResponse.json({ erreur: "Le portail de paiement n'est pas encore configuré — contacte le support." }, { status: 500 })
  }
}
