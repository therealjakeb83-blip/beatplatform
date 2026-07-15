'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { traiterGroupeAutomatisations, genererApercuGroupe, jourParisISO, type EvenementAutomatisation } from '@/lib/automatisations'
import { RECETTES } from './recettes'

const CHEMIN_INDEX = '/dashboard/business/marketing/automatisations'
const PATTERN_CATEGORIE = '/dashboard/business/marketing/automatisations/[categorie]'

// "Tout activer" — évite aux beatmakers d'activer les recettes une par une
// (et d'en oublier une) s'ils veulent faire confiance au réglage par défaut.
// Les recettes déjà configurées ne sont que basculées actif=true (jamais de
// texte écrasé) ; les recettes jamais touchées sont créées avec leur texte
// par défaut (voir _lib/recettes.ts) + activées.
export async function activerToutesLesAutomatisations(): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { data: existantes, error: lectureError } = await supabase
    .from('automatisations')
    .select('type')
    .eq('beatmaker_id', user.id)
  if (lectureError) return { erreur: lectureError.message }

  const typesExistants = new Set((existantes ?? []).map(r => r.type))
  const nouvelles = RECETTES.filter(r => !typesExistants.has(r.type))

  if (nouvelles.length > 0) {
    const { error: insertError } = await supabase.from('automatisations').insert(
      nouvelles.map(r => ({
        beatmaker_id: user.id,
        type: r.type,
        actif: true,
        objet: r.objetDefaut ?? null,
        corps: r.corpsDefaut,
        delai_heures: 10,
        heure_cible_minutes: 615,
        config: Object.fromEntries((r.champsConfig ?? []).map(c => [c.cle, c.defaut])),
      }))
    )
    if (insertError) return { erreur: insertError.message }
  }

  if (typesExistants.size > 0) {
    const { error: updateError } = await supabase
      .from('automatisations')
      .update({ actif: true })
      .eq('beatmaker_id', user.id)
    if (updateError) return { erreur: updateError.message }
  }

  revalidatePath(CHEMIN_INDEX)
  revalidatePath(PATTERN_CATEGORIE, 'page')
  return {}
}

// Signature de fin de mail — distincte du nom de boutique (nom_artiste) :
// Jake signe "Jake" à ses clients mais "Jake B" à des labels/pros, par
// exemple. Repli automatique sur nom_artiste si jamais configurée (voir
// {{signature}} dans lib/mailing.ts).
export async function sauvegarderSignature(signature: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }
  const { error } = await supabase.from('beatmakers').update({ signature_emails: signature.trim() || null }).eq('id', user.id)
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN_INDEX)
  return {}
}

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

// Supprime tout le groupe jour+client de l'événement cliqué, pas seulement
// lui — la file d'attente affiche maintenant 1 ligne par groupe résolu (ex.
// une combo), supprimer juste l'événement cliqué laisserait son frère
// traîner et repartir seul au prochain passage (résultat différent de ce
// que le beatmaker a supprimé).
export async function supprimerEvenement(evenementId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  const groupe = await chargerGroupePourEvenement(admin, evenementId, user.id)
  const ids = groupe.length > 0 ? groupe.map(e => e.id) : [evenementId]
  await admin.from('automatisation_evenements').delete().in('id', ids).eq('beatmaker_id', user.id)
  revalidatePath(CHEMIN_INDEX)
}
