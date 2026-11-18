import type { Metadata } from 'next'
import { Caveat, Jost, Space_Grotesk } from 'next/font/google'
import localFont from 'next/font/local'
import { NOM_PLATEFORME } from '@/lib/constantes'
import './vitrine3.css'
import './maquettes3.css'
import './toutenun3.css'

// Page test du site vitrine « v3 » : la v2 (charte v2) retravaillée selon le retour
// envoyé au designer le 2026-11-16 (design/charte-v2/retour-jake/). Sert à prévoir
// le résultat, ce n'est PAS une maquette du designer. v1 (/apercu-vitrine) et
// v2 (/apercu-vitrine/v2) restent intactes pour comparer. Cachée par la page de
// maintenance (préfixe /apercu-vitrine) et jamais indexée.

// Surgena VERSION D'ESSAI (licence perso, sans accents) : uniquement le grand titre
// du haut de page (compromis testé). Les titres de section passent en Geist.
const surgena = localFont({ src: './polices/surgena-essai.ttf', weight: '700', variable: '--x-police-surgena', display: 'swap', adjustFontFallback: false, fallback: [] })
const titres = Jost({ subsets: ['latin'], weight: ['600', '700'], variable: '--x-police-jost' })
// Annotations « écrites à la main » (inspiration HackerRank)
const main = Caveat({ subsets: ['latin'], weight: ['600'], variable: '--x-police-main' })
// Maquettes codées reprises de la v4 (téléphones, relance, carrousel Tout-en-un) : chiffres en Space Grotesk.
const sections = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--x-police-sections' })

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — Aperçu du site vitrine (v3)`,
  robots: { index: false, follow: false, nocache: true },
}

export default function LayoutApercuVitrineV3({ children }: { children: React.ReactNode }) {
  return (
    <div lang="fr" className={`vitrine3 ${surgena.variable} ${titres.variable} ${main.variable} ${sections.variable}`}>
      {children}
    </div>
  )
}
