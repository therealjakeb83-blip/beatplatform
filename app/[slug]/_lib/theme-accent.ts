// Dérivations de theming multi-tenant à partir d'un seul hex --ac.
// Formules et plages reprises de tokens/tokens.json (accent.overrides) — voir
// boutique-theme.css pour les dérivations calculables en CSS pur (oklch(from ...)).

export type AccentTone = 'default' | 'jaune' | 'orange' | 'violet' | 'noirBlanc'

// Les couleurs validées par Jake (tokens/tokens.json — accent.palette) —
// seules couleurs proposées, pas de personnalisation libre.
export const ACCENT_PRESETS: { valeur: string; label: string; cle: string }[] = [
  { valeur: '#2E4CF0', label: 'Bleu', cle: 'bleu' },
  { valeur: '#F2F2F2', label: 'Noir & blanc', cle: 'noirBlanc' },
  { valeur: '#E11D48', label: 'Rouge', cle: 'rouge' },
  { valeur: '#10B981', label: 'Vert', cle: 'vert' },
  { valeur: '#7C3AED', label: 'Violet', cle: 'violet' },
  { valeur: '#F97316', label: 'Orange', cle: 'orange' },
  { valeur: '#FACC15', label: 'Jaune', cle: 'jaune' },
  { valeur: '#00F6FB', label: 'Cyan', cle: 'cyan' },
]

export function estAccentValide(valeur: string): boolean {
  return ACCENT_PRESETS.some(p => p.valeur === valeur)
}

// Clé du preset exact (bleu/rouge/vert/...) — sert à accrocher un asset
// spécifique à une couleur précise (ex. background hero fourni en PNG),
// distinct de accentTone() qui ne regroupe que par teinte HSL générale.
export function accentPresetKey(hex: string): string | null {
  return ACCENT_PRESETS.find(p => p.valeur === hex)?.cle ?? null
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break
    case gn: h = (bn - rn) / d + 2; break
    default: h = (rn - gn) / d + 4
  }
  return { h: h * 60, s, l }
}

// Luminance relative WCAG (0-1) — utilisée pour la règle --ac-t du dossier de
// design ("luminance(accent) > 0.55 → texte sombre").
function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function accentTextColor(hex: string): '#0A0C13' | '#FFFFFF' {
  const [r, g, b] = hexToRgb(hex)
  return luminance(r, g, b) > 0.55 ? '#0A0C13' : '#FFFFFF'
}

export function accentTone(hex: string): AccentTone {
  const [r, g, b] = hexToRgb(hex)
  const { h, s } = rgbToHsl(r, g, b)
  if (s < 0.05) return 'noirBlanc'
  if (h >= 40 && h < 75) return 'jaune'
  if (h >= 15 && h < 40) return 'orange'
  if (h >= 250 && h < 300) return 'violet'
  return 'default'
}
