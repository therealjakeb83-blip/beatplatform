import {
  startOfDayInTz, startOfWeekInTz, startOfMonthInTz, startOfQuarterInTz, startOfYearInTz,
  addMonthsInTz, addDaysInstant, getZonedParts,
} from '@/lib/fuseau-horaire'

export type Periode =
  | 'tout'
  | 'cette-semaine'
  | 'semaine-derniere'
  | 'ce-mois'
  | 'mois-dernier'
  | 'ce-trimestre'
  | 'dernier-trimestre'
  | 'cette-annee'
  | 'annee-derniere'
  | 'custom'

export const PERIODE_OPTIONS: { key: Periode; label: string }[] = [
  { key: 'tout',               label: 'Toute la période' },
  { key: 'cette-semaine',      label: 'Cette semaine' },
  { key: 'semaine-derniere',   label: 'Semaine dernière' },
  { key: 'ce-mois',            label: 'Ce mois' },
  { key: 'mois-dernier',       label: 'Mois dernier' },
  { key: 'ce-trimestre',       label: 'Ce trimestre' },
  { key: 'dernier-trimestre',  label: 'Dernier trimestre' },
  { key: 'cette-annee',        label: 'Cette année' },
  { key: 'annee-derniere',     label: 'Année dernière' },
  { key: 'custom',             label: 'Personnalisé' },
]

export function periodeToSearch(periode: Periode, debut?: string, fin?: string): string {
  const p = new URLSearchParams({ periode })
  if (periode === 'custom') {
    if (debut) p.set('debut', debut)
    if (fin)   p.set('fin', fin)
  }
  return p.toString()
}

// `tz` = fuseau IANA du beatmaker (lib/fuseau-horaire.ts, fuseauSur() déjà
// appliqué par l'appelant — défaut Europe/Paris si non réglé). Les bornes de
// période sont calculées sur le calendrier de CE fuseau, pas en UTC : un
// beatmaker en Guyane/Martinique ou à Tokyo doit voir "ce mois-ci" démarrer
// à minuit chez lui, pas à minuit à Greenwich.
export function getPeriodDates(request: Request, tz: string): { from: string | null; to: string | null; periode: Periode } {
  const { searchParams } = new URL(request.url)
  const periode = (searchParams.get('periode') ?? 'tout') as Periode
  const now = new Date()

  switch (periode) {
    case 'cette-semaine': {
      const lundi = startOfWeekInTz(now, tz)
      return { from: lundi.toISOString(), to: now.toISOString(), periode }
    }
    case 'semaine-derniere': {
      const lundiCette = startOfWeekInTz(now, tz)
      const lundiDerniere = addDaysInstant(lundiCette, -7)
      const finDerniere = new Date(lundiCette.getTime() - 1)
      return { from: lundiDerniere.toISOString(), to: finDerniere.toISOString(), periode }
    }
    case 'ce-mois': {
      const debut = startOfMonthInTz(now, tz)
      return { from: debut.toISOString(), to: now.toISOString(), periode }
    }
    case 'mois-dernier': {
      const debutCe = startOfMonthInTz(now, tz)
      const debutDernier = addMonthsInTz(debutCe, -1, tz)
      const finDernier = new Date(debutCe.getTime() - 1)
      return { from: debutDernier.toISOString(), to: finDernier.toISOString(), periode }
    }
    case 'ce-trimestre': {
      const debut = startOfQuarterInTz(now, tz)
      return { from: debut.toISOString(), to: now.toISOString(), periode }
    }
    case 'dernier-trimestre': {
      const debutCe = startOfQuarterInTz(now, tz)
      const debutDernier = addMonthsInTz(debutCe, -3, tz)
      const finDernier = new Date(debutCe.getTime() - 1)
      return { from: debutDernier.toISOString(), to: finDernier.toISOString(), periode }
    }
    case 'cette-annee': {
      const debut = startOfYearInTz(now, tz)
      return { from: debut.toISOString(), to: now.toISOString(), periode }
    }
    case 'annee-derniere': {
      const debutCette = startOfYearInTz(now, tz)
      const debutDerniere = addMonthsInTz(debutCette, -12, tz)
      const finDerniere = new Date(debutCette.getTime() - 1)
      return { from: debutDerniere.toISOString(), to: finDerniere.toISOString(), periode }
    }
    case 'custom':
      return {
        from: searchParams.get('debut') ?? null,
        to:   searchParams.get('fin')   ?? null,
        periode,
      }
    default:
      return { from: null, to: null, periode: 'tout' }
  }
}

export function inPeriod(dateStr: string, from: string | null, to: string | null): boolean {
  if (from && dateStr < from) return false
  if (to   && dateStr > to)   return false
  return true
}

// ─── Historique adaptatif ────────────────────────────────────────────────────

export type HistoriqueSlot = {
  label: string
  fullLabel: string
  from: string
  to: string
}

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_COURTS  = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function granularite(periode: Periode, from: string | null, to: string | null): 'jours' | 'semaines' | 'mois' {
  switch (periode) {
    case 'cette-semaine':
    case 'semaine-derniere':
    case 'ce-mois':
    case 'mois-dernier':
      return 'jours'
    case 'ce-trimestre':
    case 'dernier-trimestre':
      return 'semaines'
    case 'tout':
    case 'cette-annee':
    case 'annee-derniere':
      return 'mois'
    case 'custom': {
      if (!from || !to) return 'mois'
      const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
      if (days < 35)  return 'jours'
      if (days < 120) return 'semaines'
      return 'mois'
    }
  }
}

export function getGranulariteLabel(periode: Periode, debut?: string, fin?: string): string {
  const gran = granularite(periode, debut ?? null, fin ?? null)
  switch (gran) {
    case 'jours':    return 'par jour'
    case 'semaines': return 'par semaine'
    case 'mois':     return 'par mois'
  }
}

export function getHistoriqueSlots(
  periode: Periode,
  from: string | null,
  to: string | null,
  dataFrom: string | undefined,
  tz: string,
): HistoriqueSlot[] {
  const now  = new Date()
  const gran = granularite(periode, from, to)

  if (gran === 'mois') {
    const debutInstant = from ? new Date(from) : (dataFrom ? new Date(dataFrom) : addMonthsInTz(now, -24, tz))
    const finInstant    = to ? new Date(to) : now

    let curr           = startOfMonthInTz(debutInstant, tz)
    const finMoisStart = startOfMonthInTz(finInstant, tz)

    const pCurr    = getZonedParts(curr, tz)
    const pFin     = getZonedParts(finMoisStart, tz)
    const spanMois = (pFin.year - pCurr.year) * 12 + (pFin.month - pCurr.month)
    const showYear = spanMois > 11

    const slots: HistoriqueSlot[] = []
    while (curr <= finMoisStart) {
      const p    = getZonedParts(curr, tz)
      const next = addMonthsInTz(curr, 1, tz)
      slots.push({
        label:     showYear ? `${MOIS_COURTS[p.month - 1]} ${String(p.year).slice(2)}` : MOIS_COURTS[p.month - 1],
        fullLabel: `${MOIS_COURTS[p.month - 1]}. ${p.year}`,
        from:      curr.toISOString(),
        to:        next.toISOString(),
      })
      curr = next
    }
    return slots
  }

  if (gran === 'semaines') {
    const debutInstant = from ? new Date(from) : now
    const fin          = to ? new Date(to) : now

    let curr = startOfWeekInTz(debutInstant, tz)

    const slots: HistoriqueSlot[] = []
    let i = 1
    while (curr <= fin) {
      const end          = addDaysInstant(curr, 7)
      const startParts   = getZonedParts(curr, tz)
      const lastDayParts = getZonedParts(new Date(end.getTime() - 1), tz)
      const d1 = startParts.day,   m1 = MOIS_COURTS[startParts.month - 1]
      const d2 = lastDayParts.day, m2 = MOIS_COURTS[lastDayParts.month - 1]
      slots.push({
        label:     `S${i}`,
        fullLabel: m1 === m2 ? `${d1}-${d2} ${m1}` : `${d1} ${m1}–${d2} ${m2}`,
        from:      curr.toISOString(),
        to:        end.toISOString(),
      })
      // Resnap sur le lundi 00:00 local plutôt que +7 jours fixes, pour ne
      // pas dériver d'une heure au passage d'un changement d'heure (DST).
      curr = startOfWeekInTz(end, tz)
      i++
    }
    return slots
  }

  // jours
  const debutInstant = from ? new Date(from) : startOfMonthInTz(now, tz)
  const finInstant    = to ? new Date(to) : now

  let curr               = startOfDayInTz(debutInstant, tz)
  const finDayStart      = startOfDayInTz(finInstant, tz)
  const endInclusive     = addDaysInstant(finDayStart, 1) // exclusif

  const startParts = getZonedParts(curr, tz)
  const finParts    = getZonedParts(finDayStart, tz)
  const useWeekLabels = periode === 'cette-semaine' || periode === 'semaine-derniere'
  const multiMonth    = finParts.month !== startParts.month || finParts.year !== startParts.year

  const slots: HistoriqueSlot[] = []
  while (curr < endInclusive) {
    const p    = getZonedParts(curr, tz)
    const next = addDaysInstant(curr, 1)
    const dow  = p.weekday - 1 // 1=lundi..7=dimanche -> index 0=lundi dans JOURS_COURTS
    slots.push({
      label:     useWeekLabels ? JOURS_COURTS[dow] : multiMonth ? `${p.day} ${MOIS_COURTS[p.month - 1]}` : String(p.day),
      fullLabel: `${JOURS_COURTS[dow]} ${p.day} ${MOIS_COURTS[p.month - 1]} ${p.year}`,
      from:      curr.toISOString(),
      to:        next.toISOString(),
    })
    // Resnap sur minuit local (même raison que pour les semaines ci-dessus).
    curr = startOfDayInTz(next, tz)
  }
  return slots
}

// ─── Garder getLast12Months pour retro-compat (non utilisé après migration) ──
export function getLast12Months(): Array<{ year: number; month: number; label: string; fullLabel: string }> {
  const result = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      year:      d.getFullYear(),
      month:     d.getMonth(),
      label:     MOIS_COURTS[d.getMonth()],
      fullLabel: `${MOIS_COURTS[d.getMonth()]}. ${d.getFullYear()}`,
    })
  }
  return result
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

export function fmtEuro(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function fmtEuroDisplay(euros: number): string {
  return euros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDuree(s: number | null | undefined): string {
  if (!s) return '—'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r > 0 ? `${m}m ${r}s` : `${m}m`
}
