// Libellés des plateformes d'import (sans dépendance serveur : utilisable
// dans les composants client). Format libre : la plateforme est le nom donné
// par le beatmaker (« WooCommerce », « Mon site »…), affiché tel quel.
export const LIBELLES_PLATEFORMES: Record<string, string> = { beatstars: 'BeatStars' }

export function libellePlateforme(p: string | null | undefined): string {
  return (p && LIBELLES_PLATEFORMES[p]) ?? p ?? 'Import'
}

export function libelleTypeBoutique(t: string | null | undefined): string | null {
  if (t === 'PRO_PAGE') return 'Pro Page'
  if (t === 'MARKETPLACE') return 'Marketplace'
  return t ?? null
}

// Source d'une commande importée (fiche client) : la plateforme, précisée par
// le canal quand on le connaît (BeatStars · Pro Page / Marketplace) ;
// plateforme non identifiée = « Import »
export function libelleSourceImport(plateforme: string | null | undefined, typeBoutique: string | null | undefined): string {
  const nom = plateforme ? libellePlateforme(plateforme) : 'Import'
  const canal = libelleTypeBoutique(typeBoutique)
  return canal ? `${nom} · ${canal}` : nom
}
