import type { Metadata } from 'next'
import { Jost, Space_Grotesk } from 'next/font/google'
import localFont from 'next/font/local'
import { NOM_PLATEFORME } from '@/lib/constantes'
import './vitrine4.css'

// Page test du site vitrine « v4 » : une AUTRE projection du retour envoyé au
// designer le 2026-11-16 (design/charte-v2/retour-jake/). Ce n'est PAS une maquette
// du designer. v1, v2 et v3 restent intactes pour comparer. Jamais indexée.

// Surgena VERSION D'ESSAI (licence perso, sans accents) : uniquement le grand titre du haut.
const surgena = localFont({ src: './polices/surgena-essai.ttf', weight: '700', variable: '--y-police-surgena', display: 'swap', adjustFontFallback: false, fallback: [] })
// Jost : remplace les lettres accentuées absentes de la version d'essai de Surgena.
const titres = Jost({ subsets: ['latin'], weight: ['600', '700'], variable: '--y-police-jost' })
// Titres de section : police libre proche de Surgena mais plus lisible (option 2 du retour).
const sections = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--y-police-sections' })

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — Aperçu du site vitrine (v4)`,
  robots: { index: false, follow: false, nocache: true },
}

export default function LayoutApercuVitrineV4({ children }: { children: React.ReactNode }) {
  return (
    <div lang="fr" className={`vitrine4 ${surgena.variable} ${titres.variable} ${sections.variable}`}>
      {children}
    </div>
  )
}
