import type { Metadata } from 'next'
import { Jost } from 'next/font/google'
import localFont from 'next/font/local'
import { NOM_PLATEFORME } from '@/lib/constantes'
import './vitrine2.css'

// Page test du site vitrine, charte v2 (design/charte-v2). L'ancienne version
// (charte v1) reste sur /apercu-vitrine pour comparer. Cachée par la page de
// maintenance (préfixe /apercu-vitrine) et jamais indexée.

// Titres : Surgena en VERSION D'ESSAI (polices/surgena-essai.ttf, licence « usage
// personnel, non commercial », demi-gras, SANS accents). Aperçu seulement, sur cette
// page cachée : Jake achètera la licence web s'il garde la police. Les lettres
// absentes (é, è, ê, à, ç…) s'affichent en Jost. Texte en Geist (app/layout.tsx).
const surgena = localFont({ src: './polices/surgena-essai.ttf', weight: '700', variable: '--w-police-surgena', display: 'swap', adjustFontFallback: false, fallback: [] })
const titres = Jost({ subsets: ['latin'], weight: ['600', '700'], variable: '--w-police-jost' })

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — Aperçu du site vitrine (v2)`,
  robots: { index: false, follow: false, nocache: true },
}

export default function LayoutApercuVitrineV2({ children }: { children: React.ReactNode }) {
  return (
    <div lang="fr" className={`vitrine2 ${surgena.variable} ${titres.variable}`}>
      {children}
    </div>
  )
}
