'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { traiterGroupeAutomatisations, genererApercuGroupe, jourParisISO, type EvenementAutomatisation } from '@/lib/automatisations'

const CHEMIN_INDEX = '/dashboard/business/marketing/automatisations'
const PATTERN_CATEGORIE = '/dashboard/business/marketing/automatisations/[categorie]'

export async function sauvegarderAutomatisation(
  type: string, actif: boolean, objet: string, corps: string,
  delaiHeures: number, heureCibleMinutes: number | null,
  config: Record<string, number> = {},
): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }
  const { error } = await supabase.from('automatisations').upsert({
    beatmaker_id: user.id,
    type,
    actif,
    objet: objet.trim() || null,
    corps: corps.trim() || null,
    delai_heures: delaiHeures >= 0 ? delaiHeures : 10,
    heure_cible_minutes: heureCibleMinutes,
    config,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'beatmaker_id,type' })
  if (error) {
    console.error('[automatisations] Erreur sauvegarde:', JSON.stringify(error))
    return { erreur: error.message }
  }
  revalidatePath(CHEMIN_INDEX)
  revalidatePath(PATTERN_CATEGORIE, 'page')
  return {}
}

// Un clic sur un événement (Visualiser/Exécuter) agit sur tout le groupe
// jour+client dont il fait partie, pas sur lui seul — les combinaisons se
// résolvent au niveau du groupe (docs/automatisations/combinaisons-5.7.md),
// jamais événement par événement.
async function chargerGroupePourEvenement(admin: ReturnType<typeof createAdminClient>, evenementId: string, beatmakerId: string): Promise<EvenementAutomatisation[]> {
  const { data: evenement } = await admin
    .from('automatisation_evenements')
    .select('id, beatmaker_id, client_id, type, reference_id, created_at')
    .eq('id', evenementId)
    .eq('beatmaker_id', beatmakerId)
    .single()
  if (!evenement) return []

  const jour = jourParisISO(evenement.created_at)
  const { data: siblings } = await admin
    .from('automatisation_evenements')
    .select('id, beatmaker_id, client_id, type, reference_id, created_at')
    .eq('beatmaker_id', evenement.beatmaker_id)
    .eq('client_id', evenement.client_id)
    .eq('traite', false)

  const groupe = ((siblings ?? []) as EvenementAutomatisation[]).filter(e => jourParisISO(e.created_at) === jour)
  // L'événement cliqué peut avoir déjà été traité entre-temps (ex. double-clic) —
  // s'assurer qu'il est bien dans le groupe pour ne pas renvoyer un tableau vide.
  return groupe.some(e => e.id === evenement.id) ? groupe : [evenement as EvenementAutomatisation, ...groupe]
}

export async function executerMaintenant(evenementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  const groupe = await chargerGroupePourEvenement(admin, evenementId, user.id)
  if (groupe.length === 0) return

  await traiterGroupeAutomatisations(groupe, { forcer: true })
  revalidatePath(CHEMIN_INDEX)
}

export async function previsualiser(evenementId: string): Promise<{ objet: string; corpsHtml: string } | { erreur: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const admin = createAdminClient()
  const groupe = await chargerGroupePourEvenement(admin, evenementId, user.id)
  if (groupe.length === 0) return { erreur: 'Événement introuvable.' }

  return genererApercuGroupe(groupe)
}

export async function supprimerEvenement(evenementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await admin.from('automatisation_evenements').delete().eq('id', evenementId).eq('beatmaker_id', user.id)
  revalidatePath(CHEMIN_INDEX)
}
