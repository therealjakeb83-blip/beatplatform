import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const {
    beatId, titre, bpm, cle, statut, date_sortie,
    styles, ambiances, instruments, type_beat,
    free_download_actif, image_url, mp3_tague_url,
    mp3_propre_url, wav_url, stems_url, collaborateurs, licences_actives,
    exclusif_sur_demande, exclusif_prix_override,
  } = body

  const { error: beatError } = await supabase.from('beats').insert({
    id: beatId,
    beatmaker_id: user.id,
    titre,
    bpm: bpm ? parseInt(bpm) : null,
    cle: cle || null,
    statut,
    date_sortie: date_sortie || null,
    styles: styles.length ? styles : null,
    ambiances: ambiances.length ? ambiances : null,
    instruments: instruments.length ? instruments : null,
    type_beat: type_beat.length ? type_beat : null,
    free_download_actif,
    image_url: image_url || null,
    mp3_tague_url: mp3_tague_url || null,
    mp3_propre_url: mp3_propre_url || null,
    wav_url: wav_url || null,
    stems_url: stems_url || null,
  })

  if (beatError) return Response.json({ error: beatError.message }, { status: 500 })

  if (collaborateurs?.length) {
    const splits = collaborateurs.map((c: { beatmaker_id?: string; email_invite?: string; pourcentage: number }) => ({
      beat_id: beatId,
      beatmaker_id: c.beatmaker_id || null,
      email_invite: c.email_invite || null,
      pourcentage: c.pourcentage,
      statut: c.beatmaker_id ? 'actif' : 'en_attente',
    }))

    const { error: splitsError } = await supabase.from('beat_splits').insert(splits)
    if (splitsError) return Response.json({ error: splitsError.message }, { status: 500 })
  }

  if (licences_actives) {
    const { data: licences } = await supabase
      .from('licences')
      .select('id, modele')
      .eq('beatmaker_id', user.id)
      .eq('actif', true)

    if (licences?.length) {
      const exclusifLicence = licences.find((l: { id: string; modele: string }) => l.modele === 'exclusive')
      await supabase.from('beat_licences').insert(
        licences.map((l: { id: string; modele: string }) => ({
          beat_id: beatId,
          licence_id: l.id,
          actif: licences_actives.includes(l.id),
          prix_override: l.modele === 'exclusive' && exclusif_prix_override ? parseInt(exclusif_prix_override) : null,
          sur_demande: l.modele === 'exclusive' ? (exclusif_sur_demande ?? false) : false,
        }))
      )
      void exclusifLicence
    }
  }

  return Response.json({ id: beatId })
}
