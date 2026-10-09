// Libellés des plateformes d'import (sans dépendance serveur : utilisable
// dans les composants client)
export const LIBELLES_PLATEFORMES: Record<string, string> = { beatstars: 'BeatStars' }

export function libellePlateforme(p: string | null | undefined): string {
  return (p && LIBELLES_PLATEFORMES[p]) ?? p ?? 'Import'
}

export function libelleTypeBoutique(t: string | null | undefined): string | null {
  if (t === 'PRO_PAGE') return 'Pro Page'
  if (t === 'MARKETPLACE') return 'Marketplace'
  return t ?? null
}
