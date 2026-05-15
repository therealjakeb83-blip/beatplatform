import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const { nom, prix, actif, streams_limite } = await request.json()

  const { error } = await supabase.from('licences')
    .update({
      nom,
      prix: parseInt(prix),
      actif,
      streams_limite: streams_limite ? parseInt(streams_limite) : null,
    })
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
