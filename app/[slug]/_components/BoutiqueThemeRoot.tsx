'use client'

import { useSearchParams } from 'next/navigation'

const THEMES_VALIDES = ['blue', 'red', 'green', 'purple']

export default function BoutiqueThemeRoot({
  themeDb,
  children,
}: {
  themeDb: string
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const themeApercu = searchParams.get('theme_apercu')
  const theme = themeApercu && THEMES_VALIDES.includes(themeApercu) ? themeApercu : themeDb

  return (
    <div data-shop-theme={theme} className="shop-root min-h-screen text-white pb-28 flex flex-col">
      {children}
    </div>
  )
}
