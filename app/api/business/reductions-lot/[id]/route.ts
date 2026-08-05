import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const update: Record<string, unknown> = {}
  if (body.nom !== undefined) update.nom = String(body.nom).trim()
  if (body.licence_id !== undefined) update.licence_id = body.licence_id
  if (body.nb_a_acheter !== undefined) update.nb_a_acheter = Number(body.nb_a_acheter)
  if (body.nb_offerts !== undefined) update.nb_offerts = Number(body.nb_offerts)
  if (body.actif !== undefined) update.actif = !!body.actif

  const { data, error } = await admin
    .from('reductions_lot')
    .update(update)
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ erreur: 'Une règle est déjà active pour cette licence — désactive-la avant d\'en activer une autre' }, { status: 409 })
    }
    return NextResponse.json({ erreur: error.message }, { status: 500 })
  }

  return NextResponse.json({ regle: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('reductions_lot')
    .delete()
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
