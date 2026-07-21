'use client'

import { useSearchParams } from 'next/navigation'
import { accentTextColor, accentTone, estHexValide } from '../_lib/theme-accent'
import { usePlayer } from './PlayerContext'

const RADIUS_PX: Record<string, string> = { arrondi: '16px', doux: '10px', carre: '4px' }
const RADIUS_VALIDES = ['arrondi', 'doux', 'carre']

export default function BoutiqueThemeRoot({
  accentDb,
  radiusDb,
  fontClassName,
  children,
}: {
  accentDb: string
  radiusDb: string
  fontClassName: string
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const { currentBeat } = usePlayer()

  const accentApercu = searchParams.get('theme_apercu')
  const radiusApercu = searchParams.get('radius_apercu')

  const accent = accentApercu && estHexValide(accentApercu) ? accentApercu : accentDb
  const radius = radiusApercu && RADIUS_VALIDES.includes(radiusApercu) ? radiusApercu : radiusDb

  const tone = accentTone(accent)
  const acT = accentTextColor(accent)

  return (
    <div
      data-accent-tone={tone}
      className={`shop-root ${fontClassName} min-h-screen flex flex-col${currentBeat ? ' has-player' : ''}`}
      style={{ '--ac': accent, '--ac-t': acT, '--r-card': RADIUS_PX[radius] ?? RADIUS_PX.arrondi } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
