'use server'

import { estAdmin, SLUG_ADMIN } from '@/lib/admin'
import { createAdminClient } from '@/utils/supabase/admin'
import { suspendreBoutique, reactiverBoutique, type RapportSuspension } from '@/lib/admin-boutiques'

// Pas de revalidatePath() ici (ni dans reactiverAction/corrigerBeatmakerAction
// ci-dessous) : découvert le 2026-07-24 que ça force Next.js à resynchroniser
// le composant client juste après l'action, ce qui réinitialise son état
// local — le rapport de suspension (jamais stocké nulle part, uniquement en
// mémoire côté client) disparaissait immédiatement après être apparu. Le
// composant met déjà à jour son affichage lui-même (setStatut/setChamps), pas
// besoin d'un aller-retour serveur pour cette page.
export async function suspendreAction(beatmakerId: string, raison: string): Promise<{ rapport?: RapportSuspension; erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  if (!raison.trim()) return { erreur: 'Une raison est obligatoire.' }

  // Incident 2026-07-24 : suspendre le compte admin lui-même bloque l'accès
  // à /dashboard/admin (estAdmin() dépend de ce même statut) — plus aucun
  // moyen de se réactiver via l'UI. Ce compte ne doit jamais être suspendable.
  const admin = createAdminClient()
  const { data: cible } = await admin.from('beatmakers').select('slug').eq('id', beatmakerId).single()
  if (cible?.slug === SLUG_ADMIN) return { erreur: 'Impossible de suspendre le compte admin — tu te bloquerais toi-même hors de cet outil.' }

  const rapport = await suspendreBoutique(beatmakerId, raison.trim())
  return { rapport }
}

export async function reactiverAction(beatmakerId: string): Promise<{ rapport?: RapportSuspension; erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const rapport = await reactiverBoutique(beatmakerId)
  return { rapport }
}

// Correction de champ (15a, item bas risque) — volontairement restreint aux
// infos de profil/contact. email, slug, stripe_account_id et
// paypal_account_id sont exclus du périmètre admin (cadrage 2026-07-24,
// dangerosité 4 : casse des liens partagés / peut mal router de vrais fonds).
const CHAMPS_AUTORISES = [
  'nom_artiste', 'tagline', 'bio', 'telephone',
  'adresse', 'ville', 'code_postal', 'numero_entreprise', 'notes_admin',
] as const
type ChampAutorise = typeof CHAMPS_AUTORISES[number]

// Laisser-passer gate abonnement plateforme (Étape 8b, suite) — pour les
// boutiques de test qui n'ont pas de vrai abonnement Stripe. Volontairement
// séparé de corrigerBeatmakerAction (champs texte) car c'est un bypass de
// sécurité, pas une simple correction de profil.
export async function exempterGateAction(beatmakerId: string, exempte: boolean): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const admin = createAdminClient()
  const { error } = await admin.from('beatmakers').update({ abonnement_exempte: exempte }).eq('id', beatmakerId)
  if (error) return { erreur: error.message }

  return {}
}

export async function corrigerBeatmakerAction(
  beatmakerId: string,
  champs: Partial<Record<ChampAutorise, string>>
): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const maj: Record<string, string | null> = {}
  for (const cle of CHAMPS_AUTORISES) {
    if (cle in champs) maj[cle] = champs[cle]?.trim() || null
  }
  if (Object.keys(maj).length === 0) return {}

  const admin = createAdminClient()
  const { error } = await admin.from('beatmakers').update(maj).eq('id', beatmakerId)
  if (error) return { erreur: error.message }

  return {}
}
