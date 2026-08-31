// Fuseau horaire par beatmaker — voir memory/project_fuseau_horaire_par_beatmaker.md
//
// Node gère nativement n'importe quel fuseau IANA via Intl, pas besoin de
// librairie externe. Les fonctions ci-dessous convertissent entre un instant
// UTC (ce que Postgres/Date stockent) et le "mur" (wall clock) d'un fuseau
// donné, pour calculer des bornes de période (début de mois/semaine/...)
// qui correspondent au calendrier réel du beatmaker, pas à UTC.

export const FUSEAU_HORAIRE_DEFAUT = 'Europe/Paris'

export const FUSEAUX_HORAIRES: { value: string; label: string }[] = [
  { value: 'Europe/Paris',         label: 'Paris, Bruxelles, Madrid (UTC+1/+2)' },
  { value: 'Europe/London',        label: 'Londres (UTC+0/+1)' },
  { value: 'Africa/Casablanca',    label: 'Casablanca (UTC+0/+1)' },
  { value: 'Africa/Abidjan',       label: 'Abidjan, Dakar (UTC+0)' },
  { value: 'Africa/Lagos',         label: 'Lagos (UTC+1)' },
  { value: 'Africa/Kinshasa',      label: 'Kinshasa (UTC+1)' },
  { value: 'Indian/Reunion',       label: 'La Réunion (UTC+4)' },
  { value: 'Asia/Dubai',           label: 'Dubaï (UTC+4)' },
  { value: 'Asia/Tokyo',           label: 'Tokyo (UTC+9)' },
  { value: 'Australia/Sydney',     label: 'Sydney (UTC+10/+11)' },
  { value: 'Pacific/Noumea',       label: 'Nouméa (UTC+11)' },
  { value: 'America/Martinique',   label: 'Martinique, Guadeloupe (UTC-4)' },
  { value: 'America/Cayenne',      label: 'Guyane (UTC-3)' },
  { value: 'America/Sao_Paulo',    label: 'São Paulo (UTC-3)' },
  { value: 'America/New_York',     label: 'New York (UTC-5/-4)' },
  { value: 'America/Chicago',      label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Los_Angeles',  label: 'Los Angeles (UTC-8/-7)' },
]

const FUSEAUX_VALIDES = new Set(FUSEAUX_HORAIRES.map(f => f.value))

/** Valide un fuseau IANA — retombe sur Europe/Paris si vide/invalide (jamais de plantage). */
export function fuseauSur(value: string | null | undefined): string {
  if (value && (FUSEAUX_VALIDES.has(value) || isValidTimeZone(value))) return value
  return FUSEAU_HORAIRE_DEFAUT
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

type ZonedParts = {
  year: number; month: number; day: number
  hour: number; minute: number; second: number
  weekday: number // 1 = lundi ... 7 = dimanche
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

const formatterCache = new Map<string, Intl.DateTimeFormat>()
function getFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      weekday: 'short',
    })
    formatterCache.set(tz, f)
  }
  return f
}

/** Décompose un instant UTC en date/heure "mur" dans le fuseau donné. */
export function getZonedParts(date: Date, tz: string): ZonedParts {
  const parts = getFormatter(tz).formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  return {
    year:   Number(map.year),
    month:  Number(map.month),
    day:    Number(map.day),
    hour:   Number(map.hour === '24' ? '0' : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 1,
  }
}

/** Instant UTC correspondant à une date/heure "mur" donnée dans le fuseau. */
export function zonedTimeToUtc(y: number, m: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  // 1ère approximation : traiter y/m/d/h/mi/s comme si c'était déjà de l'UTC.
  const guess = new Date(Date.UTC(y, m - 1, d, h, mi, s))
  // Corriger par l'écart réel entre ce que ce guess affiche dans tz et ce qu'on voulait.
  const guessedParts = getZonedParts(guess, tz)
  const guessedAsUtc = Date.UTC(guessedParts.year, guessedParts.month - 1, guessedParts.day, guessedParts.hour, guessedParts.minute, guessedParts.second)
  const wantedAsUtc   = Date.UTC(y, m - 1, d, h, mi, s)
  return new Date(guess.getTime() + (wantedAsUtc - guessedAsUtc))
}

export function addDaysInstant(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** Ajoute des mois calendaires dans le fuseau donné (garde le même jour/heure "mur"). */
export function addMonthsInTz(date: Date, months: number, tz: string): Date {
  const p = getZonedParts(date, tz)
  const total = p.year * 12 + (p.month - 1) + months
  const y = Math.floor(total / 12)
  const m = (((total % 12) + 12) % 12) + 1
  return zonedTimeToUtc(y, m, p.day, p.hour, p.minute, p.second, tz)
}

export function startOfDayInTz(date: Date, tz: string): Date {
  const p = getZonedParts(date, tz)
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, tz)
}

/** Lundi 00:00 de la semaine contenant `date`, dans le fuseau donné. */
export function startOfWeekInTz(date: Date, tz: string): Date {
  const dayStart = startOfDayInTz(date, tz)
  const p = getZonedParts(dayStart, tz)
  return addDaysInstant(dayStart, -(p.weekday - 1))
}

export function startOfMonthInTz(date: Date, tz: string): Date {
  const p = getZonedParts(date, tz)
  return zonedTimeToUtc(p.year, p.month, 1, 0, 0, 0, tz)
}

export function startOfQuarterInTz(date: Date, tz: string): Date {
  const p = getZonedParts(date, tz)
  const moisTrimestre = Math.floor((p.month - 1) / 3) * 3 + 1
  return zonedTimeToUtc(p.year, moisTrimestre, 1, 0, 0, 0, tz)
}

export function startOfYearInTz(date: Date, tz: string): Date {
  const p = getZonedParts(date, tz)
  return zonedTimeToUtc(p.year, 1, 1, 0, 0, 0, tz)
}

/** Clé "YYYY-MM-DD" du jour local (fuseau donné) d'un instant ISO — pour grouper par jour. */
export function dayKeyInTz(iso: string, tz: string): string {
  const p = getZonedParts(new Date(iso), tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Formate une date ISO en date longue FR, dans le fuseau du beatmaker. */
export function formatDateTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: tz, ...(opts ?? { day: '2-digit', month: 'long', year: 'numeric' }) })
}

/** Formate une date+heure ISO en FR, dans le fuseau du beatmaker. */
export function formatDateTimeTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('fr-FR', { timeZone: tz, ...(opts ?? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })
}
