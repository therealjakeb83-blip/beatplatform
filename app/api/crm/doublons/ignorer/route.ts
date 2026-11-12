import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { clientsLiesABoutique } from '@/app/dashboard/business/_lib/appartenance'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { id1, id2 } = await request.json()
  if (!id1 || !id2) return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })

  // Confidentialité entre boutiques (9d lot 0)
  const lies = await clientsLiesABoutique(supabase, user.id, [id1, id2])
  if (!lies.has(id1) || !lies.has(id2)) return NextResponse.json({ erreur: 'Contact introuvable' }, { status: 404 })

  const { error } = await supabase.from('doublons_ignores').insert({
    beatmaker_id: user.id,
    client_id_1: id1,
    client_id_2: id2,
  })

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
