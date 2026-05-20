import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { id1, id2 } = await request.json()
  if (!id1 || !id2) return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })

  const { error } = await supabase.from('doublons_ignores').insert({
    beatmaker_id: user.id,
    client_id_1: id1,
    client_id_2: id2,
  })

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
