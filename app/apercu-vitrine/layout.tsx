import type { Metadata } from 'next'
import { DM_Mono, DM_Sans } from 'next/font/google'
import { NOM_PLATEFORME } from '@/lib/constantes'
import './vitrine.css'

// Page test du site vitrine (charte v1, provisoire) : cachée par la page de
// maintenance (lib/maintenance.ts) et jamais indexée. À supprimer ou à
// transformer en vrai accueil une fois la charte finale reçue.

// DM Sans remplace Surgena en attendant ses fichiers (police réglée dans vitrine.css).
const texte = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--v-police-dm-sans' })
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--v-police-dm-mono' })

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — Aperçu du site vitrine`,
  robots: { index: false, follow: false, nocache: true },
}

export default function LayoutApercuVitrine({ children }: { children: React.ReactNode }) {
  return (
    <div lang="fr" className={`vitrine ${texte.variable} ${mono.variable}`}>
      {children}
    </div>
  )
}
