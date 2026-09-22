import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { traiterCollaborateursBeat, notifierNouvellesInvitations, type CollaborateurEntrant } from '@/lib/collaboration-beat'
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
    exclusif_sur_demande, licence_overrides,
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

  // Collaborateurs (Phase 12) : chacun est ajouté à l'état « invitée » — jamais
  // actif d'office. L'invitation part à l'enregistrement du beat (pas avant),
  // et le beat reste hors vente tant que tous n'ont pas accepté.
  const admin = createAdminClient()
  let nouvellesInvitations: Awaited<ReturnType<typeof traiterCollaborateursBeat>> = { ok: true, nouvelles: [] }
  if (collaborateurs?.length) {
    nouvellesInvitations = await traiterCollaborateursBeat({
      admin,
      beatId,
      proprietaireId: user.id,
      collaborateurs: collaborateurs as CollaborateurEntrant[],
      licencesActivesIds: licences_actives,
      licenceOverrides: licence_overrides,
      exclusifSurDemande: exclusif_sur_demande,
    })
    if (!nouvellesInvitations.ok) {
      // Beat tout neuf, sans vente ni collaboration : on l'efface pour que le
      // formulaire puisse être renvoyé corrigé avec le même identifiant.
      await admin.from('beats').delete().eq('id', beatId)
      return Response.json({ error: nouvellesInvitations.erreur }, { status: nouvellesInvitations.status })
    }
  }

  if (licences_actives) {
    const { data: licences } = await supabase
      .from('licences')
      .select('id, modele')
      .eq('beatmaker_id', user.id)
      .eq('actif', true)

    if (licences?.length) {
      await supabase.from('beat_licences').insert(
        licences.map((l: { id: string; modele: string }) => {
          const override = licence_overrides?.[l.id]
          return {
            beat_id: beatId,
            licence_id: l.id,
            actif: licences_actives.includes(l.id),
            // Prix spécifique à ce beat (Phase 12) — pour toutes les licences,
            // pas seulement Exclusive ; vide/absent = suit le prix général.
            prix_override: override != null && override !== '' ? parseInt(String(override)) : null,
            sur_demande: l.modele === 'exclusive' ? (exclusif_sur_demande ?? false) : false,
          }
        })
      )
    }
  }

  if (nouvellesInvitations.ok) {
    await notifierNouvellesInvitations({ admin, beatId, proprietaireId: user.id, titreBeat: titre, nouvelles: nouvellesInvitations.nouvelles })
  }

  return Response.json({ id: beatId })
}
