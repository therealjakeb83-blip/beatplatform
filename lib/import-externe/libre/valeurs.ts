import { zonedTimeToUtc } from '@/lib/fuseau-horaire'

// Lecture des montants et des dates d'un fichier « format libre ».

export type Devise = 'EUR' | 'USD'

// « 59.95 », « 59,95 € », « 1 234,56 », « $1,234.56 », « -12 », « 12,5 EUR »…
// null si la cellule est vide ; undefined si elle est remplie mais illisible
export function lireMontant(brut: string): number | null | undefined {
  const s = brut.trim()
  if (!s) return null
  let t = s.replace(/ | /g, ' ').replace(/€|\$|eur(os?)?|usd|us\$/gi, '').replace(/\s+/g, '')
  if (!t) return undefined
  const negatif = /^-|^\(.*\)$/.test(t)
  t = t.replace(/^[-+(]|\)$/g, '')
  if (!/^\d[\d.,']*$/.test(t)) return undefined
  t = t.replace(/'/g, '')
  const virgule = t.lastIndexOf(','), point = t.lastIndexOf('.')
  if (virgule >= 0 && point >= 0) {
    // le dernier des deux est la décimale, l'autre sépare les milliers
    t = virgule > point ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (virgule >= 0) {
    // « 1,234 » / « 1,234,567 » = milliers à l'américaine ; « 59,95 » = décimale
    const milliers = t.indexOf(',') !== virgule || t.length - virgule - 1 === 3
    t = milliers ? t.replace(/,/g, '') : t.replace(',', '.')
  } else if (point >= 0 && t.indexOf('.') !== point) {
    t = t.replace(/\./g, '')
  }
  const n = Number(t)
  if (!Number.isFinite(n)) return undefined
  return Math.round((negatif ? -n : n) * 100) / 100
}

// Devise écrite dans une cellule de montant ou de devise
export function deviseEcrite(brut: string): Devise | null {
  const s = brut.trim().toLowerCase()
  if (!s) return null
  if (/€|\beur\b|\beuros?\b/.test(s)) return 'EUR'
  if (/\$|\busd\b|\bus\$|dollar/.test(s)) return 'USD'
  return null
}

export function deviseInconnue(brut: string): boolean {
  const s = brut.trim()
  return !!s && /^[a-z]{3}$/i.test(s) && !deviseEcrite(s)
}

// ── Dates ─────────────────────────────────────────────────────────────────
// Formes acceptées : AAAA-MM-JJ[ HH:MM[:SS]] (ISO, avec ou sans « T »/fuseau),
// JJ/MM/AAAA ou MM/JJ/AAAA (« / », « . » ou « - », année sur 2 ou 4 chiffres)
// + heure facultative. Sans fuseau, l'heure est celle de la boutique.

export type OrdreDate = 'jm' | 'mj'

export type DateLue = { annee: number; mois: number; jour: number; heure: number; minute: number; seconde: number; isoAvecFuseau: string | null }

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i
const NUM = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T,]+(\d{1,2})[:h](\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i

export function formeDate(brut: string): 'iso' | 'numerique' | null {
  const s = brut.trim()
  if (ISO.test(s)) return 'iso'
  if (NUM.test(s)) return 'numerique'
  return null
}

// Sens jour/mois imposé par les valeurs du fichier : 'jm' si un 1er nombre
// dépasse 12, 'mj' si un 2e le dépasse, null si rien ne permet de trancher
// (alors on DEMANDE au beatmaker)
export function ordreDateImpose(valeurs: string[]): OrdreDate | null {
  let jm = false, mj = false
  for (const v of valeurs) {
    const m = v.trim().match(NUM)
    if (!m) continue
    if (Number(m[1]) > 12) jm = true
    if (Number(m[2]) > 12) mj = true
  }
  if (jm && !mj) return 'jm'
  if (mj && !jm) return 'mj'
  return null
}

function valide(a: number, mo: number, j: number, h: number, mi: number, s: number): boolean {
  if (mo < 1 || mo > 12 || j < 1 || h > 23 || mi > 59 || s > 59) return false
  return j <= new Date(Date.UTC(a, mo, 0)).getUTCDate()
}

// null si vide, undefined si remplie mais illisible
export function lireDate(brut: string, ordre: OrdreDate | null): DateLue | null | undefined {
  const s = brut.trim()
  if (!s) return null
  let m = s.match(ISO)
  if (m) {
    const [a, mo, j, h, mi, se] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0', m[6] ?? '0'].map(Number)
    if (!valide(a, mo, j, h, mi, se)) return undefined
    return { annee: a, mois: mo, jour: j, heure: h, minute: mi, seconde: se, isoAvecFuseau: m[7] ? s.replace(' ', 'T') : null }
  }
  m = s.match(NUM)
  if (m) {
    if (!ordre) return undefined
    const p1 = Number(m[1]), p2 = Number(m[2])
    let a = Number(m[3])
    if (m[3].length === 2) a += a >= 70 ? 1900 : 2000
    const [j, mo] = ordre === 'jm' ? [p1, p2] : [p2, p1]
    let h = Number(m[4] ?? 0)
    const mi = Number(m[5] ?? 0), se = Number(m[6] ?? 0)
    if (m[7]) { const pm = m[7].toLowerCase() === 'pm'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12 }
    if (!valide(a, mo, j, h, mi, se)) return undefined
    return { annee: a, mois: mo, jour: j, heure: h, minute: mi, seconde: se, isoAvecFuseau: null }
  }
  return undefined
}

// Instant réel d'une date lue : avec fuseau écrit → tel quel ; sinon heure
// murale dans le fuseau de la boutique
export function instantDate(d: DateLue, fuseau: string): Date {
  if (d.isoAvecFuseau) return new Date(d.isoAvecFuseau)
  return zonedTimeToUtc(d.annee, d.mois, d.jour, d.heure, d.minute, d.seconde, fuseau)
}
