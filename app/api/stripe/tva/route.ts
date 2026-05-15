import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { tva_active, tva_taux, tva_numero } = await request.json()

  const { error } = await supabase
    .from('beatmakers')
    .update({
      tva_active: Boolean(tva_active),
      tva_taux: tva_active ? Number(tva_taux) : null,
      tva_numero: tva_active ? (tva_numero ?? null) : null,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
