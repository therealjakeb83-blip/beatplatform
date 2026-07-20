import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const { mis_en_avant } = await request.json()

  if (typeof mis_en_avant !== 'boolean') {
    return Response.json({ error: 'Valeur invalide' }, { status: 400 })
  }

  const { error } = await supabase
    .from('beats')
    .update({ mis_en_avant })
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
