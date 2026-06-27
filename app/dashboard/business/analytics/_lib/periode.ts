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

export function getPeriodDates(request: Request): { from: string | null; to: string | null; periode: Periode } {
  const { searchParams } = new URL(request.url)
  const periode = (searchParams.get('periode') ?? 'tout') as Periode
  const now = new Date()

  switch (periode) {
    case 'cette-semaine': {
      const dow = now.getDay() || 7
      const lundi = new Date(now)
      lundi.setDate(now.getDate() - (dow - 1))
      lundi.setHours(0, 0, 0, 0)
      return { from: lundi.toISOString(), to: now.toISOString(), periode }
    }
    case 'semaine-derniere': {
      const dow = now.getDay() || 7
      const lundiCette = new Date(now)
      lundiCette.setDate(now.getDate() - (dow - 1))
      lundiCette.setHours(0, 0, 0, 0)
      const lundiDerniere = new Date(lundiCette)
      lundiDerniere.setDate(lundiCette.getDate() - 7)
      const dimanche = new Date(lundiCette)
      dimanche.setDate(lundiCette.getDate() - 1)
      dimanche.setHours(23, 59, 59, 999)
      return { from: lundiDerniere.toISOString(), to: dimanche.toISOString(), periode }
    }
    case 'ce-mois':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to:   now.toISOString(),
        periode,
      }
    case 'mois-dernier':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        to:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString(),
        periode,
      }
    case 'ce-trimestre': {
      const q = Math.floor(now.getMonth() / 3)
      return {
        from: new Date(now.getFullYear(), q * 3, 1).toISOString(),
        to:   now.toISOString(),
        periode,
      }
    }
    case 'dernier-trimestre': {
      const q = Math.floor(now.getMonth() / 3)
      return {
        from: new Date(now.getFullYear(), (q - 1) * 3, 1).toISOString(),
        to:   new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999).toISOString(),
        periode,
      }
    }
    case 'cette-annee':
      return {
        from: new Date(now.getFullYear(), 0, 1).toISOString(),
        to:   now.toISOString(),
        periode,
      }
    case 'annee-derniere':
      return {
        from: new Date(now.getFullYear() - 1, 0, 1).toISOString(),
        to:   new Date(now.getFullYear(), 0, 0, 23, 59, 59, 999).toISOString(),
        periode,
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
  dataFrom?: string,
): HistoriqueSlot[] {
  const now  = new Date()
  const gran = granularite(periode, from, to)

  if (gran === 'mois') {
    const debut    = new Date(from ?? dataFrom ?? new Date(now.getFullYear() - 2, now.getMonth(), 1))
    const fin      = new Date(to ?? now)
    const curr     = new Date(debut.getFullYear(), debut.getMonth(), 1)
    const finMois  = new Date(fin.getFullYear(), fin.getMonth(), 1)
    const spanMois = (finMois.getFullYear() - curr.getFullYear()) * 12 + finMois.getMonth() - curr.getMonth()
    const showYear = spanMois > 11

    const slots: HistoriqueSlot[] = []
    while (curr <= finMois) {
      const y = curr.getFullYear()
      const m = curr.getMonth()
      slots.push({
        label:     showYear ? `${MOIS_COURTS[m]} ${String(y).slice(2)}` : MOIS_COURTS[m],
        fullLabel: `${MOIS_COURTS[m]}. ${y}`,
        from:      new Date(y, m, 1).toISOString(),
        to:        new Date(y, m + 1, 1).toISOString(),
      })
      curr.setMonth(curr.getMonth() + 1)
    }
    return slots
  }

  if (gran === 'semaines') {
    const debut = new Date(from ?? now)
    const fin   = new Date(to ?? now)
    const curr  = new Date(debut)
    const dow   = curr.getDay() || 7
    curr.setDate(curr.getDate() - (dow - 1))
    curr.setHours(0, 0, 0, 0)

    const slots: HistoriqueSlot[] = []
    let i = 1
    while (curr <= fin) {
      const start   = new Date(curr)
      const end     = new Date(curr)
      end.setDate(end.getDate() + 7)
      const lastDay = new Date(end.getTime() - 1)
      const d1 = start.getDate(),   m1 = MOIS_COURTS[start.getMonth()]
      const d2 = lastDay.getDate(), m2 = MOIS_COURTS[lastDay.getMonth()]
      slots.push({
        label:     `S${i}`,
        fullLabel: m1 === m2 ? `${d1}-${d2} ${m1}` : `${d1} ${m1}–${d2} ${m2}`,
        from:      start.toISOString(),
        to:        end.toISOString(),
      })
      curr.setDate(curr.getDate() + 7)
      i++
    }
    return slots
  }

  // jours
  const debut = new Date(from ?? new Date(now.getFullYear(), now.getMonth(), 1))
  const fin   = new Date(to ?? now)
  const curr  = new Date(debut)
  curr.setHours(0, 0, 0, 0)
  const endInclusive = new Date(fin)
  endInclusive.setHours(23, 59, 59, 999)

  const useWeekLabels = periode === 'cette-semaine' || periode === 'semaine-derniere'
  const multiMonth    = fin.getMonth() !== debut.getMonth() || fin.getFullYear() !== debut.getFullYear()

  const slots: HistoriqueSlot[] = []
  while (curr <= endInclusive) {
    const d   = curr.getDate()
    const m   = curr.getMonth()
    const dow = (curr.getDay() + 6) % 7
    const next = new Date(curr)
    next.setDate(next.getDate() + 1)
    slots.push({
      label:     useWeekLabels ? JOURS_COURTS[dow] : multiMonth ? `${d} ${MOIS_COURTS[m]}` : String(d),
      fullLabel: `${JOURS_COURTS[dow]} ${d} ${MOIS_COURTS[m]} ${curr.getFullYear()}`,
      from:      new Date(curr).toISOString(),
      to:        next.toISOString(),
    })
    curr.setDate(curr.getDate() + 1)
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
