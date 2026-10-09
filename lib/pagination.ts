// Pagination des tableaux du dashboard : un seul réglage de taille pour tout
// le dashboard (décision de Jake, 2026-10-09) — le dernier choix fait dans
// n'importe quel tableau s'applique partout, mémorisé dans un cookie lu par
// le serveur pour que le premier affichage soit déjà à la bonne taille.

export const TAILLES_PAGE = [20, 50, 100] as const
export type TaillePage = typeof TAILLES_PAGE[number]
export const TAILLE_PAGE_DEFAUT: TaillePage = 50
export const COOKIE_TAILLE_PAGE = 'taille_tableaux'

export function lireTaillePage(valeur: string | null | undefined): TaillePage {
  const n = Number(valeur)
  return (TAILLES_PAGE as readonly number[]).includes(n) ? (n as TaillePage) : TAILLE_PAGE_DEFAUT
}

export function nbPages(total: number, taille: number): number {
  return Math.max(1, Math.ceil(total / taille))
}

// Page demandée dans l'adresse, ramenée dans les bornes une fois le total connu
export function bornerPage(page: number, total: number, taille: number): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), nbPages(total, taille))
}

export function lirePageAdresse(valeur: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(valeur) ? valeur[0] : (valeur ?? '1'), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// Mode « par l'adresse » quand le serveur a déjà toutes les lignes : il n'envoie que la page demandée
export function decouperPage<T>(lignes: T[], pageDemandee: number, taille: number): { page: number; lignes: T[] } {
  const page = bornerPage(pageDemandee, lignes.length, taille)
  return { page, lignes: lignes.slice((page - 1) * taille, page * taille) }
}
