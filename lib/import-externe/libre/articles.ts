import { cleLicence, type FormeLicence, type SeparateurArticles } from './association'

// Plusieurs articles dans une même case, et licence collée au titre.
// Détection LARGE (valable pour tout format), jamais appliquée sans la
// validation du beatmaker (décisions de Jake, 2026-10-10).

const REGEX_SEPARATEURS: Record<SeparateurArticles, RegExp> = {
  virgule_quantite: /\s*,\s*(?=\d+\s*[×x]\s)/i,
  retour_ligne: /\s*\n\s*/,
  point_virgule: /\s*;\s*/,
  barre: /\s*\|\s*/,
  plus: /\s+\+\s+/,
  slash: /\s+\/\s+/,
  virgule: /\s*,\s*/,
}

const QUANTITES = [/^(\d+)\s*[×x]\s+/i, /\s+[×x]\s*(\d+)$/i, /\s*\(x\s*(\d+)\)$/i]

function quantiteEcrite(texte: string): { reste: string; quantite: number } | null {
  for (const re of QUANTITES) {
    const m = texte.match(re)
    if (m) return { reste: texte.replace(re, '').trim(), quantite: Math.max(1, Number(m[1])) }
  }
  return null
}

// Les titres portent-ils une quantité (« 1× Titre ») ? Oui si c'est le cas de
// presque toutes les cases remplies : on la retire alors du titre affiché
export function titresAvecQuantite(cases: string[]): boolean {
  const remplies = cases.filter(c => c.trim())
  if (remplies.length === 0) return false
  return remplies.filter(c => quantiteEcrite(c.trim().split('\n')[0].trim())).length / remplies.length >= 0.8
}

export type Article = { titre: string; quantite: number }

export function decouperCase(texte: string, separateur: SeparateurArticles | null, avecQuantite: boolean): Article[] {
  const morceaux = separateur ? texte.split(REGEX_SEPARATEURS[separateur]) : [texte]
  return morceaux.map(m => m.trim()).filter(Boolean).map(m => {
    const q = avecQuantite ? quantiteEcrite(m) : null
    return q ? { titre: q.reste, quantite: q.quantite } : { titre: m, quantite: 1 }
  })
}

export type DetectionSeparateur = {
  separateur: SeparateurArticles
  nbCases: number
  // preuve : colonne « quantité / nombre d'articles » d'accord sur toutes les
  // lignes, ou quantité écrite sur chaque morceau
  prouve: boolean
}

// comptes = nombre d'articles attendu par case (colonne quantité), si connu
export function detecterSeparateur(cases: string[], comptes: (number | null)[] | null): DetectionSeparateur | null {
  const candidats = (Object.keys(REGEX_SEPARATEURS) as SeparateurArticles[]).map(sep => {
    const decoupes = cases.map(c => c.split(REGEX_SEPARATEURS[sep]).map(s => s.trim()).filter(Boolean))
    const nbCases = decoupes.filter(d => d.length > 1).length
    const morceaux = decoupes.flat()
    const avecQte = morceaux.length ? morceaux.filter(m => quantiteEcrite(m)).length / morceaux.length : 0
    let accord: number | null = null
    if (comptes) {
      let ok = 0, total = 0
      decoupes.forEach((d, i) => {
        const attendu = comptes[i]
        if (attendu === null || attendu === undefined) return
        total++
        const n = d.reduce((s, m) => s + (quantiteEcrite(m)?.quantite ?? 1), 0)
        if (n === attendu) ok++
      })
      accord = total ? ok / total : null
    }
    return { separateur: sep, nbCases, avecQte, accord }
  }).filter(c => c.nbCases >= 3)
  if (candidats.length === 0) return null
  candidats.sort((a, b) => (b.accord ?? 0) - (a.accord ?? 0) || b.avecQte - a.avecQte || b.nbCases - a.nbCases)
  const c = candidats[0]
  return { separateur: c.separateur, nbCases: c.nbCases, prouve: c.accord === 1 || (c.accord === null && c.avecQte === 1) }
}

// Découpage qui semble faux (un morceau très court, ou qui ne finit pas comme
// les autres) : montré en premier au beatmaker
export function decoupageSuspect(articles: Article[]): boolean {
  if (articles.length < 2) return false
  if (articles.some(a => a.titre.length < 4)) return true
  const fins = articles.map(a => a.titre.match(/\s[-–|]\s*(\S+(?:\s\S+)?)$/)?.[1] ?? null)
  return fins.some(f => f === null) && fins.some(f => f !== null)
}

// ── Licence collée au titre ──────────────────────────────────────────────

const FORMES: Record<FormeLicence, (t: string) => { titre: string; brut: string } | null> = {
  tiret: t => { const m = t.match(/^(.+?)\s+[-–—]\s+([^-–—]+)$/); return m ? { titre: m[1].trim(), brut: m[2].trim() } : null },
  barre: t => { const m = t.match(/^(.+?)\s*\|\s*([^|]+)$/); return m ? { titre: m[1].trim(), brut: m[2].trim() } : null },
  parentheses: t => { const m = t.match(/^(.+?)\s*\(([^()]+)\)$/); return m ? { titre: m[1].trim(), brut: m[2].trim() } : null },
  crochets: t => { const m = t.match(/^\[([^\]]+)\]\s*(.+)$/); return m ? { titre: m[2].trim(), brut: m[1].trim() } : null },
}

export const LIBELLES_FORMES: Record<FormeLicence, string> = {
  tiret: '« Titre - Licence »',
  barre: '« Titre | Licence »',
  parentheses: '« Titre (Licence) »',
  crochets: '« [Licence] Titre »',
}

const MOTS_LICENCE = /\b(licen[cs]e|lease|mp3|wav|stems?|trackouts?|exclusi(f|ve|vite)|unlimited|illimit\w*|premium|basic|standard)\b/i

// « Licence WAV » → « WAV » ; « WAV Lease » → « WAV »
export function nettoyerLicence(brut: string): string {
  const net = brut.replace(/\b(licen[cs]e|lease)\b/gi, '').replace(/\s+/g, ' ').trim()
  return net || brut.trim()
}

export function extraireLicence(titre: string, forme: FormeLicence): { titre: string; licence: string } | null {
  const r = FORMES[forme](titre.trim())
  if (!r || !r.titre) return null
  return { titre: r.titre, licence: nettoyerLicence(r.brut) }
}

export type ValeurLicence = { cle: string; libelle: string; nb: number; motCle: boolean }

export type DetectionLicence = { forme: FormeLicence; nbTitres: number; valeurs: ValeurLicence[] }

// Licence = partie séparée du titre de façon régulière, qui prend PEU de
// valeurs différentes revenant souvent, de préférence avec des mots de licence
export function detecterFormeLicence(titres: string[]): DetectionLicence | null {
  const remplis = titres.map(t => t.trim()).filter(Boolean)
  if (remplis.length === 0) return null
  let meilleur: (DetectionLicence & { score: number }) | null = null
  for (const forme of Object.keys(FORMES) as FormeLicence[]) {
    const extraits = remplis.map(t => FORMES[forme](t)).filter((x): x is { titre: string; brut: string } => !!x && !!x.titre)
    if (extraits.length < Math.max(2, remplis.length * 0.3)) continue
    const valeurs = valeursLicence(extraits.map(e => e.brut))
    const motsCles = extraits.filter(e => MOTS_LICENCE.test(e.brut)).length / extraits.length
    // petit fichier : trop peu de lignes pour juger la répétition, on exige
    // alors des mots de licence (« Licence WAV », « MP3 Lease »…)
    if (extraits.length < 30) {
      if (motsCles < 0.5 || valeurs.length > 6) continue
    } else if (valeurs.length > 15 || valeurs.length > extraits.length / 3) continue
    const score = extraits.length * (0.5 + motsCles)
    if (!meilleur || score > meilleur.score) meilleur = { forme, nbTitres: extraits.length, valeurs, score }
  }
  if (!meilleur) return null
  const { score: _score, ...detection } = meilleur
  void _score
  return detection
}

export function valeursLicence(brutes: string[]): ValeurLicence[] {
  const parCle = new Map<string, { libelles: Map<string, number>; nb: number; motCle: boolean }>()
  for (const b of brutes) {
    const libelle = nettoyerLicence(b)
    const cle = cleLicence(libelle)
    if (!cle) continue
    const v = parCle.get(cle) ?? { libelles: new Map(), nb: 0, motCle: false }
    v.nb++
    v.libelles.set(libelle, (v.libelles.get(libelle) ?? 0) + 1)
    if (MOTS_LICENCE.test(b)) v.motCle = true
    parCle.set(cle, v)
  }
  return [...parCle].map(([cle, v]) => ({
    cle,
    libelle: [...v.libelles].sort((a, b) => b[1] - a[1])[0][0],
    nb: v.nb,
    motCle: v.motCle,
  })).sort((a, b) => b.nb - a.nb || a.libelle.localeCompare(b.libelle, 'fr'))
}
