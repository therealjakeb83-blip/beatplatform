'use client'

import { useSearchParams } from 'next/navigation'
import { accentTextColor, accentTone, estAccentValide } from '../_lib/theme-accent'
import { usePlayer } from './PlayerContext'

// Radius de carte figé sur "doux" pour toutes les boutiques — plus de
// personnalisation par le beatmaker.
const R_CARD = '10px'

export default function BoutiqueThemeRoot({
  accentDb,
  fontClassName,
  children,
}: {
  accentDb: string
  fontClassName: string
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const { currentBeat } = usePlayer()

  const accentApercu = searchParams.get('theme_apercu')
  const accent = accentApercu && estAccentValide(accentApercu) ? accentApercu : accentDb

  const tone = accentTone(accent)
  const acT = accentTextColor(accent)

  return (
    <div
      data-accent-tone={tone}
      className={`shop-root ${fontClassName} min-h-screen flex flex-col${currentBeat ? ' has-player' : ''}`}
      style={{ '--ac': accent, '--ac-t': acT, '--r-card': R_CARD } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
