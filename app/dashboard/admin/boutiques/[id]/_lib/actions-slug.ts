'use server'

import { estAdmin } from '@/lib/admin'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { changerSlugBoutique, disponibiliteSlug, type DisponibiliteSlug } from '@/lib/slug-boutique'
import { nettoyerSlug } from '@/lib/slug-regles'

// Rang 9c bis lot 3 : seul l'admin change un slug déjà choisi ou libère un
// ancien nom (décisions 4 et 4 bis). Pas de revalidatePath (voir actions.ts) :
// le composant recharge la page lui-même.

async function idAdmin(): Promise<string | null> {
  if (!(await estAdmin())) return null
  const { data: { user } } = await (await createClient()).auth.getUser()
  return user?.id ?? null
}

export async function verifierSlugAdminAction(beatmakerId: string, slug: string): Promise<DisponibiliteSlug | { erreur: string }> {
  if (!(await idAdmin())) return { erreur: 'Non autorisé.' }
  return disponibiliteSlug(slug, beatmakerId)
}

export async function changerSlugAdminAction(beatmakerId: string, slug: string, confirmation: string): Promise<{ erreur?: string; slug?: string }> {
  const admin = await idAdmin()
  if (!admin) return { erreur: 'Non autorisé.' }
  if (nettoyerSlug(confirmation) !== nettoyerSlug(slug)) return { erreur: "Retape l'adresse exactement pour confirmer." }
  const resultat = await changerSlugBoutique(beatmakerId, slug, admin)
  return resultat.ok ? { slug: resultat.slug } : { erreur: resultat.erreur }
}

export async function libererAncienNomAction(ancienNomId: string): Promise<{ erreur?: string }> {
  const admin = await idAdmin()
  if (!admin) return { erreur: 'Non autorisé.' }
  const { data, error } = await createAdminClient()
    .from('anciens_slugs')
    .update({ libere_le: new Date().toISOString(), libere_par: admin })
    .eq('id', ancienNomId)
    .is('libere_le', null)
    .select('slug, beatmaker_id')
  if (error) return { erreur: error.message }
  if (!data?.length) return { erreur: 'Cet ancien nom est déjà libéré.' }
  console.log('[slug] Ancien nom libéré par l\'admin', data[0].slug, 'boutique', data[0].beatmaker_id)
  return {}
}
