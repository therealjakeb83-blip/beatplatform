import type { SupabaseClient } from '@supabase/supabase-js'

// Plan Free (Phase 12 lot 2, Q16/Q18/Q19) — remplace l'ancien blocage total
// de proxy.ts. Un beatmaker sans abonnement plateforme actif garde un accès
// PARTIEL au dashboard business au lieu d'être redirigé sur toutes les
// pages. Menu PROVISOIRE (définition complète = rang 15a de la roadmap) :
// Collaborations, Paiements, Facturation, Analytics, Commandes, Abonnement.
// Modifiable ici sans toucher aux pages elles-mêmes.

const BASE = '/dashboard/business'

// Chemins accessibles tels quels (comparaison exacte). `/dashboard/business`
// (Vue d'ensemble) est volontairement une page d'atterrissage libre, pas
// une fonctionnalité Pro : un beatmaker clique "Business" depuis /dashboard
// et doit y arriver normalement, sans deviner une URL — retour de Jake le
// 2026-09-22, un simple lien caché n'est pas une vraie porte d'entrée.
const CHEMINS_LIBRES_EXACTS = ['/dashboard', BASE, `${BASE}/`]

// Préfixes accessibles (le chemin lui-même ou tout ce qui suit un '/').
const PREFIXES_LIBRES = [
  '/dashboard/paiements',
  `${BASE}/facturation`,
  `${BASE}/analytics`,
  `${BASE}/commandes`,
  `${BASE}/collabs`,
]

export function pageAccessibleEnPlanFree(pathname: string): boolean {
  const chemin = pathname.split('?')[0]
  if (CHEMINS_LIBRES_EXACTS.includes(chemin)) return true
  return PREFIXES_LIBRES.some(p => chemin === p || chemin.startsWith(`${p}/`))
}

// Un abonnement plateforme actif (payant ou en essai) donne un accès total —
// même requête que l'ancien gate de proxy.ts (Étape 8b), extraite ici pour
// être partagée avec le rendu du menu (Sidebar) sans dupliquer la logique.
export async function aUnAbonnementPlateformeActif(
  supabase: SupabaseClient,
  beatmakerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('abonnements_plateforme')
    .select('id')
    .eq('beatmaker_id', beatmakerId)
    .in('statut', ['actif', 'en_essai'])
    .limit(1)
    .maybeSingle()
  return !!data
}
