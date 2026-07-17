import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerInvitationCollab } from '@/lib/emails'
import { synchroniserCategoriesPersonnalisees } from '@/lib/categories'

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

  // Styles/Type beat tapés à la main deviennent des catégories personnelles
  // (source=beatmaker) réutilisables sur les prochains beats — jamais pour
  // Ambiances/Instruments (lecture seule, Phase 7).
  await synchroniserCategoriesPersonnalisees(supabase, user.id, { styles, typeBeat: type_beat })

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

  // Email d'invitation aux collabs non inscrits si le beat est publié directement
  if (statut === 'public' && collaborateurs?.length) {
    const emailInvites = (collaborateurs as Array<{ beatmaker_id?: string; email_invite?: string; pourcentage: number }>)
      .filter(c => c.email_invite)
    if (emailInvites.length) {
      const adminBm = createAdminClient()
      const { data: bm } = await adminBm.from('beatmakers').select('nom_artiste').eq('id', user.id).single()
      if (bm?.nom_artiste) {
        await Promise.all(
          emailInvites.map(c =>
            envoyerInvitationCollab({
              to: c.email_invite!,
              nomProprietaire: bm.nom_artiste,
              titreBeat: titre,
              pourcentage: c.pourcentage,
              beatmakerId: user.id,
            }).catch(() => {})
          )
        )
      }
    }
  }

  return Response.json({ id: beatId })
}
