// Phase 11 (9 bis) — accès à /telechargement/[commandeId]. L'UUID de commande
// reste la vraie protection (privé, difficile à deviner) ; ce mécanisme n'est
// qu'une confirmation légère par email, pas un vrai système d'authentification
// (pas de lien magique, pas de code envoyé — décision explicite de Jake,
// 2026-09-18, voir memory/project_grillme_9bis_synthese.md).

export function cookieAccesTelechargement(commandeId: string): string {
  return `dl_${commandeId}`
}

// "Indéfiniment", comme le lien de l'email de confirmation — 1 an, aligné sur
// le cookie abo_{slug} déjà utilisé ailleurs pour la même famille de besoin.
export const DUREE_COOKIE_ACCES = 60 * 60 * 24 * 365
