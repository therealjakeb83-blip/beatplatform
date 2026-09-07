import { createClient } from '@/utils/supabase/server'

function versEntierOuNull(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const n = parseInt(String(valeur))
  return Number.isFinite(n) ? n : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const {
    nom, prix, actif, streams_limite,
    ventes_physiques_limite, vues_video_limite, clips_video_limite, radio_tv_limite,
    lives_performances_autorise,
  } = await request.json()

  const { error } = await supabase.from('licences')
    .update({
      nom,
      prix: parseInt(prix),
      actif,
      streams_limite: versEntierOuNull(streams_limite),
      ventes_physiques_limite: versEntierOuNull(ventes_physiques_limite),
      vues_video_limite: versEntierOuNull(vues_video_limite),
      clips_video_limite: versEntierOuNull(clips_video_limite),
      radio_tv_limite: versEntierOuNull(radio_tv_limite),
      lives_performances_autorise: !!lives_performances_autorise,
    })
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
