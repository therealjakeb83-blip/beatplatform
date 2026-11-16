import type { Metadata } from 'next'
import { Jost } from 'next/font/google'
import { NOM_PLATEFORME } from '@/lib/constantes'
import './vitrine2.css'

// Page test du site vitrine, charte v2 (design/charte-v2). L'ancienne version
// (charte v1) reste sur /apercu-vitrine pour comparer. Cachée par la page de
// maintenance (préfixe /apercu-vitrine) et jamais indexée.

// Jost remplace Surgena (titres) en attendant ses fichiers ; le texte est en
// Geist, déjà chargée par app/layout.tsx (police de la charte).
const titres = Jost({ subsets: ['latin'], weight: ['600', '700'], variable: '--w-police-jost' })

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — Aperçu du site vitrine (v2)`,
  robots: { index: false, follow: false, nocache: true },
}

export default function LayoutApercuVitrineV2({ children }: { children: React.ReactNode }) {
  return (
    <div lang="fr" className={`vitrine2 ${titres.variable}`}>
      {children}
    </div>
  )
}
