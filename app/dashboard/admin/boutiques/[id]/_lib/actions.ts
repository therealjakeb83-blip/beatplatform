'use server'

import { estAdmin } from '@/lib/admin'
import { createAdminClient } from '@/utils/supabase/admin'
import { suspendreBoutique, reactiverBoutique, type RapportSuspension } from '@/lib/admin-boutiques'
import { revalidatePath } from 'next/cache'

function chemin(id: string) {
  return `/dashboard/admin/boutiques/${id}`
}

export async function suspendreAction(beatmakerId: string, raison: string): Promise<{ rapport?: RapportSuspension; erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  if (!raison.trim()) return { erreur: 'Une raison est obligatoire.' }

  const rapport = await suspendreBoutique(beatmakerId, raison.trim())
  revalidatePath(chemin(beatmakerId))
  return { rapport }
}

export async function reactiverAction(beatmakerId: string): Promise<{ rapport?: RapportSuspension; erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const rapport = await reactiverBoutique(beatmakerId)
  revalidatePath(chemin(beatmakerId))
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

  revalidatePath(chemin(beatmakerId))
  return {}
}
