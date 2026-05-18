import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ erreur: 'session_id manquant' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('commandes')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .single()

  if (!data) {
    return NextResponse.json({ erreur: 'Commande introuvable' }, { status: 404 })
  }

  return NextResponse.json({ commande_id: data.id })
}
