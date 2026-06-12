export function initiales(nom: string | null | undefined): string {
  if (!nom) return '?'
  const parts = nom.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function joursDepuis(date: string | Date | null | undefined): number {
  if (!date) return Infinity
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
}

export function formatMontant(cents: number, devise = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function compareSigne(delta: number): '+' | '-' | '' {
  if (delta > 0) return '+'
  if (delta < 0) return '-'
  return ''
}
