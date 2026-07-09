'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { traiterEvenementAutomatisation, genererApercuAutomatisation, type TypeAutomatisation } from '@/lib/automatisations'

const CHEMIN_INDEX = '/dashboard/business/marketing/automatisations'
const PATTERN_CATEGORIE = '/dashboard/business/marketing/automatisations/[categorie]'

export async function sauvegarderAutomatisation(
  type: string, actif: boolean, objet: string, corps: string,
  delaiHeures: number, heureCibleMinutes: number | null,
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

export async function executerMaintenant(evenementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  const { data: evenement } = await admin
    .from('automatisation_evenements')
    .select('id, beatmaker_id, client_id, type, reference_id, created_at')
    .eq('id', evenementId)
    .eq('beatmaker_id', user.id)
    .single()
  if (!evenement) return

  await traiterEvenementAutomatisation(evenement, { forcer: true })
  revalidatePath(CHEMIN_INDEX)
}

export async function previsualiser(evenementId: string): Promise<{ objet: string; corpsHtml: string } | { erreur: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const admin = createAdminClient()
  const { data: evenement } = await admin
    .from('automatisation_evenements')
    .select('beatmaker_id, client_id, type, reference_id')
    .eq('id', evenementId)
    .eq('beatmaker_id', user.id)
    .single()
  if (!evenement) return { erreur: 'Événement introuvable.' }

  return genererApercuAutomatisation(evenement as { beatmaker_id: string; client_id: string; type: TypeAutomatisation; reference_id: string })
}

export async function supprimerEvenement(evenementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  await admin.from('automatisation_evenements').delete().eq('id', evenementId).eq('beatmaker_id', user.id)
  revalidatePath(CHEMIN_INDEX)
}
