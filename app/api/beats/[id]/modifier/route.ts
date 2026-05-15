import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const {
    titre, bpm, cle, statut, date_sortie,
    styles, ambiances, instruments, type_beat,
    free_download_actif, image_url, mp3_tague_url,
    mp3_propre_url, wav_url, stems_url, collaborateurs,
  } = body

  const update: Record<string, unknown> = {
    titre, statut, free_download_actif,
    bpm: bpm ? parseInt(bpm) : null,
    cle: cle || null,
    date_sortie: date_sortie || null,
    styles: styles?.length ? styles : null,
    ambiances: ambiances?.length ? ambiances : null,
    instruments: instruments?.length ? instruments : null,
    type_beat: type_beat?.length ? type_beat : null,
  }

  if (image_url) update.image_url = image_url
  if (mp3_tague_url) update.mp3_tague_url = mp3_tague_url
  if (mp3_propre_url) update.mp3_propre_url = mp3_propre_url
  if (wav_url) update.wav_url = wav_url
  if (stems_url) update.stems_url = stems_url

  const { error } = await supabase.from('beats')
    .update(update)
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (collaborateurs) {
    await supabase.from('beat_splits').delete().eq('beat_id', id)
    if (collaborateurs.length > 0) {
      await supabase.from('beat_splits').insert(
        collaborateurs.map((c: { beatmaker_id?: string; email_invite?: string; pourcentage: number }) => ({
          beat_id: id,
          beatmaker_id: c.beatmaker_id || null,
          email_invite: c.email_invite || null,
          pourcentage: c.pourcentage,
          statut: c.beatmaker_id ? 'actif' : 'en_attente',
        }))
      )
    }
  }

  return Response.json({ success: true })
}
