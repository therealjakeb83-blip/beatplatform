export type Periode =
  | 'tout'
  | 'ce-mois'
  | 'mois-dernier'
  | 'ce-trimestre'
  | 'dernier-trimestre'
  | 'cette-annee'
  | 'annee-derniere'
  | 'custom'

export const PERIODE_OPTIONS: { key: Periode; label: string }[] = [
  { key: 'tout',              label: 'Toute la période' },
  { key: 'ce-mois',          label: 'Ce mois' },
  { key: 'mois-dernier',     label: 'Mois dernier' },
  { key: 'ce-trimestre',     label: 'Ce trimestre' },
  { key: 'dernier-trimestre',label: 'Dernier trimestre' },
  { key: 'cette-annee',      label: 'Cette année' },
  { key: 'annee-derniere',   label: 'Année dernière' },
  { key: 'custom',           label: 'Personnalisé' },
]

export function periodeToSearch(periode: Periode, debut?: string, fin?: string): string {
  const p = new URLSearchParams({ periode })
  if (periode === 'custom') {
    if (debut) p.set('debut', debut)
    if (fin)   p.set('fin', fin)
  }
  return p.toString()
}

// Côté serveur (Route Handlers)
export function getPeriodDates(request: Request): { from: string | null; to: string | null } {
  const { searchParams } = new URL(request.url)
  const periode = (searchParams.get('periode') ?? 'tout') as Periode
  const now = new Date()

  switch (periode) {
    case 'ce-mois':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to:   now.toISOString(),
      }
    case 'mois-dernier':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        to:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString(),
      }
    case 'ce-trimestre': {
      const q = Math.floor(now.getMonth() / 3)
      return {
        from: new Date(now.getFullYear(), q * 3, 1).toISOString(),
        to:   now.toISOString(),
      }
    }
    case 'dernier-trimestre': {
      const q = Math.floor(now.getMonth() / 3)
      return {
        from: new Date(now.getFullYear(), (q - 1) * 3, 1).toISOString(),
        to:   new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999).toISOString(),
      }
    }
    case 'cette-annee':
      return {
        from: new Date(now.getFullYear(), 0, 1).toISOString(),
        to:   now.toISOString(),
      }
    case 'annee-derniere':
      return {
        from: new Date(now.getFullYear() - 1, 0, 1).toISOString(),
        to:   new Date(now.getFullYear(), 0, 0, 23, 59, 59, 999).toISOString(),
      }
    case 'custom':
      return {
        from: searchParams.get('debut') ?? null,
        to:   searchParams.get('fin')   ?? null,
      }
    default:
      return { from: null, to: null }
  }
}

// Filtre JS pour les données déjà chargées
export function inPeriod(dateStr: string, from: string | null, to: string | null): boolean {
  if (from && dateStr < from) return false
  if (to   && dateStr > to)   return false
  return true
}

// Génère les 12 derniers mois (du plus ancien au plus récent)
export function getLast12Months(): Array<{ year: number; month: number; label: string; fullLabel: string }> {
  const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const result = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      year:      d.getFullYear(),
      month:     d.getMonth(),
      label:     MOIS[d.getMonth()],
      fullLabel: `${MOIS[d.getMonth()]}. ${d.getFullYear()}`,
    })
  }
  return result
}

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
