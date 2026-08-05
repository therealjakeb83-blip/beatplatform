import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  const nbAAcheter = Number(body.nb_a_acheter)
  const nbOfferts = Number(body.nb_offerts)
  if (!body.licence_id || !body.nom?.trim() || !(nbAAcheter >= 1) || !(nbOfferts >= 1)) {
    return NextResponse.json({ erreur: 'Champs invalides' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('reductions_lot')
    .insert({
      beatmaker_id: user.id,
      licence_id:   body.licence_id,
      nom:          body.nom.trim(),
      nb_a_acheter: nbAAcheter,
      nb_offerts:   nbOfferts,
      actif:        body.actif ?? true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ erreur: 'Une règle est déjà active pour cette licence — désactive-la avant d\'en activer une autre' }, { status: 409 })
    }
    console.error('[reductions-lot POST]', error)
    return NextResponse.json({ erreur: error.message }, { status: 500 })
  }

  return NextResponse.json({ regle: data })
}
