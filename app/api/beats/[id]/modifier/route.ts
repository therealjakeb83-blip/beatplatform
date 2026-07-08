import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerInvitationCollab } from '@/lib/emails'

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
    mp3_propre_url, wav_url, stems_url, collaborateurs, licences_actives,
    exclusif_sur_demande, exclusif_prix_override,
  } = body

  // Données nécessaires pour détecter les transitions de statut et nouveaux collabs
  let wasPublic = false
  let previousEmailInvites: string[] = []

  if (statut === 'public') {
    const { data: currentBeat } = await supabase.from('beats')
      .select('statut')
      .eq('id', id)
      .eq('beatmaker_id', user.id)
      .single()
    wasPublic = currentBeat?.statut === 'public'

    if (wasPublic && collaborateurs) {
      const { data: existingInvites } = await supabase.from('beat_splits')
        .select('email_invite')
        .eq('beat_id', id)
        .not('email_invite', 'is', null)
      previousEmailInvites = (existingInvites ?? []).map(s => s.email_invite!)
    }
  }

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

  if (licences_actives) {
    const { data: licences } = await supabase
      .from('licences')
      .select('id, modele')
      .eq('beatmaker_id', user.id)
      .eq('actif', true)

    if (licences?.length) {
      await supabase.from('beat_licences').upsert(
        licences.map((l: { id: string; modele: string }) => ({
          beat_id: id,
          licence_id: l.id,
          actif: licences_actives.includes(l.id),
          prix_override: l.modele === 'exclusive' && exclusif_prix_override ? parseInt(exclusif_prix_override) : null,
          sur_demande: l.modele === 'exclusive' ? (exclusif_sur_demande ?? false) : false,
        })),
        { onConflict: 'beat_id,licence_id' }
      )
    }
  }

  // Email d'invitation aux collabs non inscrits
  if (statut === 'public') {
    type CollabInput = { beatmaker_id?: string; email_invite?: string; pourcentage: number }
    let invitesANotifier: Array<{ email: string; pourcentage: number }> = []

    if (!wasPublic) {
      // Beat vient de passer public → notifier tous les email_invite
      if (collaborateurs) {
        invitesANotifier = (collaborateurs as CollabInput[])
          .filter(c => c.email_invite)
          .map(c => ({ email: c.email_invite!, pourcentage: c.pourcentage }))
      } else {
        // Statut change mais pas les collabs → query les splits existants
        const { data: splits } = await supabase.from('beat_splits')
          .select('email_invite, pourcentage')
          .eq('beat_id', id)
          .not('email_invite', 'is', null)
        invitesANotifier = (splits ?? []).map(s => ({ email: s.email_invite!, pourcentage: s.pourcentage }))
      }
    } else if (collaborateurs) {
      // Beat déjà public → notifier seulement les nouveaux email_invite
      invitesANotifier = (collaborateurs as CollabInput[])
        .filter(c => c.email_invite && !previousEmailInvites.includes(c.email_invite))
        .map(c => ({ email: c.email_invite!, pourcentage: c.pourcentage }))
    }

    if (invitesANotifier.length) {
      const adminBm = createAdminClient()
      const { data: bm } = await adminBm.from('beatmakers').select('nom_artiste').eq('id', user.id).single()
      if (bm?.nom_artiste) {
        await Promise.all(
          invitesANotifier.map(inv =>
            envoyerInvitationCollab({
              to: inv.email,
              nomProprietaire: bm.nom_artiste,
              titreBeat: titre,
              pourcentage: inv.pourcentage,
              beatmakerId: user.id,
            }).catch(() => {})
          )
        )
      }
    }
  }

  return Response.json({ success: true })
}
