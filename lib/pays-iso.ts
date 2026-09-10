// Liste des pays (code ISO 3166-1 alpha-2 + libellé français), pour le
// <select> Pays de la page de paiement custom (Phase 9). Les codes sont
// stockés/envoyés à Stripe (billing_details.address.country attend un code
// ISO, pas un nom en texte libre) ; le libellé français est dérivé via
// Intl.DisplayNames plutôt que traduit à la main, pour rester correct et
// éviter de retaper ~195 noms de pays.
const CODES_ISO = [
  'FR', 'AF', 'ZA', 'AL', 'DZ', 'DE', 'AD', 'AO', 'AG', 'SA', 'AR', 'AM', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BE', 'BZ', 'BJ', 'BT', 'BY', 'MM', 'BO', 'BA', 'BW', 'BR', 'BN',
  'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'CL', 'CN', 'CY', 'CO', 'KM', 'CG', 'CD', 'KR',
  'KP', 'CR', 'CI', 'HR', 'CU', 'DK', 'DJ', 'DO', 'EG', 'AE', 'EC', 'ER', 'ES', 'EE', 'SZ',
  'US', 'ET', 'FJ', 'FI', 'GA', 'GM', 'GE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GQ', 'GY',
  'HT', 'HN', 'HU', 'IN', 'ID', 'IQ', 'IR', 'IE', 'IS', 'IL', 'IT', 'JM', 'JP', 'JO', 'KZ',
  'KE', 'KG', 'KI', 'KW', 'LA', 'LS', 'LV', 'LB', 'LR', 'LY', 'LI', 'LT', 'LU', 'MK', 'MG',
  'MY', 'MW', 'MV', 'ML', 'MT', 'MA', 'MH', 'MU', 'MR', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME',
  'MZ', 'NA', 'NR', 'NP', 'NI', 'NE', 'NG', 'NO', 'NZ', 'OM', 'UG', 'UZ', 'PK', 'PW', 'PA',
  'PG', 'PY', 'NL', 'PE', 'PH', 'PL', 'PT', 'QA', 'CF', 'DO', 'CZ', 'RO', 'GB', 'RU', 'RW',
  'KN', 'SM', 'VC', 'LC', 'SB', 'WS', 'ST', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SO',
  'SD', 'SS', 'LK', 'SE', 'CH', 'SR', 'SY', 'TJ', 'TZ', 'TD', 'TH', 'TL', 'TG', 'TO', 'TT',
  'TN', 'TM', 'TR', 'TV', 'UA', 'UY', 'VU', 'VA', 'VE', 'VN', 'YE', 'ZM', 'ZW',
] as const

export type Pays = { code: string; label: string }

let cache: Pays[] | null = null

export function listePays(): Pays[] {
  if (cache) return cache
  const noms = new Intl.DisplayNames(['fr'], { type: 'region' })
  const pays = [...new Set(CODES_ISO)]
    .map(code => ({ code, label: noms.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  cache = pays
  return pays
}
