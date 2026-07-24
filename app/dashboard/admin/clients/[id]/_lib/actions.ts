'use server'

import { estAdmin } from '@/lib/admin'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

// Périmètre bas risque uniquement (15a) — pas d'email (identifiant de
// connexion partagé entre boutiques, cf. cadrage 2026-07-24).
const CHAMPS_AUTORISES = ['nom', 'prenom', 'telephone', 'langue'] as const
type ChampAutorise = typeof CHAMPS_AUTORISES[number]

export async function corrigerClientAction(
  clientId: string,
  champs: Partial<Record<ChampAutorise, string>>
): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const maj: Record<string, string | null> = {}
  for (const cle of CHAMPS_AUTORISES) {
    if (cle in champs) maj[cle] = champs[cle]?.trim() || null
  }
  if (Object.keys(maj).length === 0) return {}

  const admin = createAdminClient()
  const { error } = await admin.from('clients').update(maj).eq('id', clientId)
  if (error) return { erreur: error.message }

  revalidatePath(`/dashboard/admin/clients/${clientId}`)
  return {}
}
