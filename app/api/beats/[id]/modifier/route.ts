import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { traiterCollaborateursBeat, notifierNouvellesInvitations, type CollaborateurEntrant } from '@/lib/collaboration-beat'
import { synchroniserCategoriesPersonnalisees } from '@/lib/categories'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params

  // Beat vendu en licence Exclusive (Phase 6) : plus aucune modification
  // possible (article 4.1 du contrat — le beatmaker s'interdit toute
  // nouvelle exploitation de l'Œuvre). Vérifié ici, pas seulement côté
  // page, pour bloquer aussi un appel direct à cette route.
  const { data: beatActuel, error: beatActuelError } = await supabase
    .from('beats')
    .select('statut')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (beatActuelError || !beatActuel) {
    return Response.json({ error: 'Beat introuvable.' }, { status: 404 })
  }
  if (beatActuel?.statut === 'vendu') {
    return Response.json({ error: 'Ce beat a été vendu en licence Exclusive et ne peut plus être modifié.' }, { status: 403 })
  }

  const body = await request.json()
  const {
    titre, bpm, cle, statut, date_sortie,
    styles, ambiances, instruments, type_beat,
    free_download_actif, image_url, mp3_tague_url,
    mp3_propre_url, wav_url, stems_url, collaborateurs, licences_actives,
    exclusif_sur_demande, licence_overrides,
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

  await synchroniserCategoriesPersonnalisees(supabase, user.id, { styles, typeBeat: type_beat })

  // Collaborateurs (Phase 12) : cette route ne fait plus qu'AJOUTER de nouvelles
  // invitations (état « invitée »). Une collaboration existante ne se modifie
  // ni ne se supprime ici : la part est verrouillée, et retirer une invitation,
  // quitter ou évincer passent par leurs propres routes (avec journal).
  const admin = createAdminClient()
  const traitement = await traiterCollaborateursBeat({
    admin,
    beatId: id,
    proprietaireId: user.id,
    collaborateurs: collaborateurs as CollaborateurEntrant[] | undefined,
    licencesActivesIds: licences_actives,
    licenceOverrides: licence_overrides,
    exclusifSurDemande: exclusif_sur_demande,
  })
  if (!traitement.ok) return Response.json({ error: traitement.erreur }, { status: traitement.status })

  if (licences_actives) {
    const { data: licences, error: licencesError } = await supabase
      .from('licences')
      .select('id, modele')
      .eq('beatmaker_id', user.id)
      .eq('actif', true)

    if (licencesError) {
      return Response.json({ error: `Impossible de charger les licences : ${licencesError.message}` }, { status: 500 })
    }

    if (licences?.length) {
      const { error: beatLicencesError } = await supabase.from('beat_licences').upsert(
        licences.map((l: { id: string; modele: string }) => {
          const override = licence_overrides?.[l.id]
          return {
            beat_id: id,
            licence_id: l.id,
            actif: licences_actives.includes(l.id),
            prix_override: override != null && override !== '' ? parseInt(String(override)) : null,
            sur_demande: l.modele === 'exclusive' ? (exclusif_sur_demande ?? false) : false,
          }
        }),
        { onConflict: 'beat_id,licence_id' }
      )

      if (beatLicencesError) {
        return Response.json({ error: `Impossible d'enregistrer les licences du beat : ${beatLicencesError.message}` }, { status: 500 })
      }
    }
  }

  await notifierNouvellesInvitations({ admin, beatId: id, proprietaireId: user.id, titreBeat: titre, nouvelles: traitement.nouvelles })

  // La page d'édition et les pages publiques ont déjà pu être visitées : sans
  // invalidation, une navigation client peut réafficher leur ancien état même
  // après une écriture réussie dans beat_licences.
  revalidatePath(`/dashboard/business/beats/${id}/modifier`)
  revalidatePath('/dashboard/business/beats')
  revalidatePath('/[slug]', 'page')
  revalidatePath('/[slug]/[beatId]', 'page')

  return Response.json({ success: true })
}
