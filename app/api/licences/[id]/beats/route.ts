import { createClient } from '@/utils/supabase/server'

// Liste des beats qui utilisent une licence donnée (Phase 12) — sert au
// sélecteur "certains beats" quand on change son prix général.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params

  const { data: licence } = await supabase.from('licences').select('id').eq('id', id).eq('beatmaker_id', user.id).maybeSingle()
  if (!licence) return Response.json({ error: 'Licence introuvable' }, { status: 404 })

  const { data: liens, error } = await supabase
    .from('beat_licences')
    .select('beat_id, prix_override, beats!inner(id, titre, beatmaker_id, supprime_le)')
    .eq('licence_id', id)
    .eq('actif', true)
    .eq('beats.beatmaker_id', user.id)
    .is('beats.supprime_le', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  type Ligne = { beat_id: string; prix_override: number | null; beats: { id: string; titre: string } | { id: string; titre: string }[] | null }
  const beats = ((liens ?? []) as Ligne[]).map(l => {
    const beat = Array.isArray(l.beats) ? l.beats[0] : l.beats
    return { id: l.beat_id, titre: beat?.titre ?? 'Beat', aDejaUnPrixSpecifique: l.prix_override != null }
  })

  return Response.json(beats)
}
