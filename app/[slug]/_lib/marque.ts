// Marque de boutique : logo (défaut) ou nom écrit dans un style typographique
// au choix — voir boutique-theme.css .shop-wordmark--* et handoff_marque_logo_ou_nom.

export type MarqueAffichage = 'logo' | 'nom'

export const STYLES_NOM_MARQUE = ['hero', 'grotesque', 'condense', 'massif', 'moderne', 'espace'] as const
export type StyleNomMarque = typeof STYLES_NOM_MARQUE[number]

export function estMarqueAffichageValide(valeur: string): valeur is MarqueAffichage {
  return valeur === 'logo' || valeur === 'nom'
}

export function estStyleNomMarqueValide(valeur: string): valeur is StyleNomMarque {
  return (STYLES_NOM_MARQUE as readonly string[]).includes(valeur)
}
