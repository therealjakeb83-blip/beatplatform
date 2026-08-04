import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const paymentIntentId = searchParams.get('payment_intent')

  if (!sessionId && !paymentIntentId) {
    return NextResponse.json({ erreur: 'session_id ou payment_intent manquant' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const query = supabase.from('commandes').select('id')

  const { data } = sessionId
    ? await query.eq('stripe_session_id', sessionId).maybeSingle()
    : await query.eq('stripe_payment_id', paymentIntentId).maybeSingle()

  if (!data) {
    return NextResponse.json({ erreur: 'Commande introuvable' }, { status: 404 })
  }

  return NextResponse.json({ commande_id: data.id })
}
