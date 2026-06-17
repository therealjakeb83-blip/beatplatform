import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })

  const { error } = await supabase
    .from('doublons_ignores')
    .delete()
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
