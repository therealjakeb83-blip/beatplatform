import { readSheet } from 'read-excel-file/universal'

// Lecture d'un fichier « format libre » en tableau de textes, identique dans
// le navigateur (assistant) et sur le serveur (qui relit tout avant d'écrire).
// CSV : séparateur deviné (« , » « ; » tabulation), cellules multi-lignes,
// UTF-8 ou Windows-1252 (Excel en français). Excel (.xlsx) : 1re feuille,
// chaque cellule convertie en texte (date Excel → « AAAA-MM-JJ HH:MM »).

export type Tableau = {
  enTetes: string[]
  lignes: { numero: number; cellules: string[] }[]
}

export class ErreurTableau extends Error {}

export function estExcel(nom: string): boolean {
  return /\.xlsx$/i.test(nom)
}

export function decoderTexte(octets: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets)
  } catch {
    return new TextDecoder('windows-1252').decode(octets)
  }
}

const SEPARATEURS_CSV = [',', ';', '\t'] as const

// Séparateur = celui qui donne le même nombre de colonnes (≥ 2) sur le plus de
// lignes parmi les premières, guillemets respectés
function devinerSeparateur(texte: string): string {
  const debut = texte.slice(0, 20000)
  let meilleur: string = ','
  let meilleurScore = -1
  for (const sep of SEPARATEURS_CSV) {
    const lignes = decouperCsv(debut, sep).slice(0, 30).filter(l => l.cellules.some(c => c.trim()))
    if (lignes.length === 0) continue
    const largeurs = new Map<number, number>()
    for (const l of lignes) largeurs.set(l.cellules.length, (largeurs.get(l.cellules.length) ?? 0) + 1)
    const [largeur, nb] = [...largeurs].sort((a, b) => b[1] - a[1])[0]
    if (largeur < 2) continue
    const score = nb * 1000 + largeur
    if (score > meilleurScore) { meilleurScore = score; meilleur = sep }
  }
  return meilleur
}

export function decouperCsv(texte: string, sep: string): { numero: number; cellules: string[] }[] {
  const t = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte
  const lignes: { numero: number; cellules: string[] }[] = []
  let cellules: string[] = []
  let cellule = ''
  let entreGuillemets = false
  let numero = 1
  let debutLigne = 1
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (entreGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { cellule += '"'; i++ }
        else entreGuillemets = false
      } else {
        if (c === '\n') numero++
        cellule += c
      }
      continue
    }
    if (c === '"' && cellule === '') { entreGuillemets = true; continue }
    if (c === sep) { cellules.push(cellule); cellule = ''; continue }
    if (c === '\r') continue
    if (c === '\n') {
      cellules.push(cellule)
      lignes.push({ numero: debutLigne, cellules })
      cellules = []
      cellule = ''
      numero++
      debutLigne = numero
      continue
    }
    cellule += c
  }
  if (cellule !== '' || cellules.length > 0) {
    cellules.push(cellule)
    lignes.push({ numero: debutLigne, cellules })
  }
  return lignes
}

const deux = (n: number) => String(n).padStart(2, '0')

function celluleEnTexte(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    // Date Excel = heure « murale », sans fuseau : lue en UTC par la bibliothèque
    const base = `${v.getUTCFullYear()}-${deux(v.getUTCMonth() + 1)}-${deux(v.getUTCDate())}`
    return v.getUTCHours() || v.getUTCMinutes() ? `${base} ${deux(v.getUTCHours())}:${deux(v.getUTCMinutes())}` : base
  }
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6)
  return String(v)
}

// En-têtes = 1re ligne qui a au moins 2 cellules remplies (certains exports
// commencent par un titre ou une ligne vide) ; « sep=; » d'Excel ignoré
function construire(brutes: { numero: number; cellules: string[] }[]): Tableau {
  const utiles = brutes.filter(l => !(l.cellules.length === 1 && /^sep=.$/i.test(l.cellules[0].trim())))
  const iEnTetes = utiles.findIndex(l => l.cellules.filter(c => c.trim()).length >= 2)
  if (iEnTetes < 0) throw new ErreurTableau('Ce fichier ne contient pas de tableau lisible (il faut une ligne de titres de colonnes, puis une ligne par vente).')
  const enTetes = utiles[iEnTetes].cellules.map(c => c.trim())
  while (enTetes.length && !enTetes[enTetes.length - 1]) enTetes.pop()
  const largeur = enTetes.length
  const lignes = utiles.slice(iEnTetes + 1)
    .filter(l => l.cellules.some(c => c.trim()))
    .map(l => ({ numero: l.numero, cellules: Array.from({ length: largeur }, (_, i) => (l.cellules[i] ?? '').trim()) }))
  if (lignes.length === 0) throw new ErreurTableau('Ce fichier ne contient aucune vente : seulement la ligne des titres de colonnes.')
  return { enTetes: enTetes.map((h, i) => h || `Colonne ${i + 1}`), lignes }
}

export async function lireTableau(nom: string, octets: ArrayBuffer): Promise<Tableau> {
  if (estExcel(nom)) {
    let feuille: unknown[][]
    try {
      feuille = await readSheet(octets) as unknown as unknown[][]
    } catch {
      throw new ErreurTableau('Fichier Excel illisible. Enregistre-le à nouveau au format .xlsx (ou en CSV) puis réessaie.')
    }
    return construire(feuille.map((ligne, i) => ({ numero: i + 1, cellules: (ligne ?? []).map(celluleEnTexte) })))
  }
  if (/\.xls$/i.test(nom)) {
    throw new ErreurTableau('Ancien format Excel (.xls) non pris en charge : enregistre le fichier au format .xlsx ou CSV.')
  }
  const texte = decoderTexte(octets)
  return construire(decouperCsv(texte, devinerSeparateur(texte)))
}

// Empreinte d'un jeu de colonnes (mémoire du format) : noms normalisés, dans l'ordre
export function signatureEnTetes(enTetes: string[]): string {
  return enTetes.map(h => h.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()).join('\u001f')
}
