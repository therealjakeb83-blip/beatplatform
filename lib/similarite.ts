// Ressemblance entre deux textes (0 à 1), distance de Levenshtein bornée.
// Partagé par la détection de doublons du CRM et « Relier les beats ».

// Deux lignes réutilisées (pas de tableau alloué par paire) : la détection
// compare toutes les paires, soit ~1 million pour 1 500 contacts.
let ligneA = new Uint16Array(64)
let ligneB = new Uint16Array(64)
// borne : dès que toute la ligne dépasse la borne, la distance finale aussi
// (renvoie alors une distance hors d'atteinte, la valeur exacte n'importe plus)
export function levenshtein(a: string, b: string, borne = Infinity): number {
  const m = a.length, n = b.length
  if (ligneA.length <= n) { ligneA = new Uint16Array(n + 1); ligneB = new Uint16Array(n + 1) }
  let prec = ligneA, cour = ligneB
  for (let j = 0; j <= n; j++) prec[j] = j
  for (let i = 1; i <= m; i++) {
    cour[0] = i
    let minLigne = i
    for (let j = 1; j <= n; j++) {
      cour[j] = a.charCodeAt(i - 1) === b.charCodeAt(j - 1)
        ? prec[j - 1]
        : 1 + Math.min(prec[j], cour[j - 1], prec[j - 1])
      if (cour[j] < minLigne) minLigne = cour[j]
    }
    if (minLigne > borne) return m + n + 1
    const t = prec; prec = cour; cour = t
  }
  return prec[n]
}

// seuil : en dessous, la valeur exacte n'importe pas — la différence de
// longueur suffit souvent à l'écarter sans calcul
export function sim(a: string, b: string, seuil = 0): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const max = Math.max(a.length, b.length)
  if (1 - Math.abs(a.length - b.length) / max < seuil) return 0
  return 1 - levenshtein(a, b, Math.ceil((1 - seuil) * max)) / max
}
