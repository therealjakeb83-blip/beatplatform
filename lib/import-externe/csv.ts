// Lecteur CSV (RFC 4180) sur le texte entier : une cellule entre guillemets
// peut contenir des virgules, des guillemets doublés et des retours à la ligne.
// Chaque ligne renvoyée garde son numéro de ligne d'origine dans le fichier
// (pour les rejets affichés au beatmaker).

export type LigneCsv = { numero: number; cellules: string[] }

export function lireCsv(texte: string): LigneCsv[] {
  const t = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte
  const lignes: LigneCsv[] = []
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
    if (c === '"') { entreGuillemets = true; continue }
    if (c === ',') { cellules.push(cellule); cellule = ''; continue }
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

// Séparateur « ; » par défaut : c'est ce qu'attend Excel en français (avec
// « , » tout s'affiche dans la colonne A)
export function ecrireCsv(lignes: string[][], separateur = ';'): string {
  const echapper = (v: string) => v.includes(separateur) || /["\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  return lignes.map(l => l.map(echapper).join(separateur)).join('\r\n')
}
