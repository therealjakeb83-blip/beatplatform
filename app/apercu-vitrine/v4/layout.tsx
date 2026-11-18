import type { Metadata } from 'next'
import { Cal_Sans, Jost, Poppins, Space_Grotesk, Ubuntu } from 'next/font/google'
import localFont from 'next/font/local'
import { NOM_PLATEFORME } from '@/lib/constantes'
import './vitrine4.css'
import './maquettes4.css'
import './toutenun4.css'

// Page test du site vitrine « v4 » : une AUTRE projection du retour envoyé au
// designer le 2026-11-16 (design/charte-v2/retour-jake/). Ce n'est PAS une maquette
// du designer. v1, v2 et v3 restent intactes pour comparer. Jamais indexée.

// Surgena VERSION D'ESSAI (licence perso, sans accents) : uniquement le grand titre du haut.
const surgena = localFont({ src: './polices/surgena-essai.ttf', weight: '700', variable: '--y-police-surgena', display: 'swap', adjustFontFallback: false, fallback: [] })
// Jost : remplace les lettres accentuées absentes de la version d'essai de Surgena.
const titres = Jost({ subsets: ['latin'], weight: ['600', '700'], variable: '--y-police-jost' })
// Titres de section : police libre proche de Surgena mais plus lisible (option 2 du retour).
const sections = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--y-police-sections' })

// Test des 3 polices de titres proposées par le designer (Brand Style Guide_TH, 2026-11-18).
// Choix via ?police=poppins|ubuntu|calsans (sélecteur flottant en bas de page).
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700'], variable: '--y-police-poppins' })
const ubuntu = Ubuntu({ subsets: ['latin'], weight: ['500', '700'], variable: '--y-police-ubuntu' })
const calSans = Cal_Sans({ subsets: ['latin'], weight: '400', variable: '--y-police-calsans' })

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — Aperçu du site vitrine (v4)`,
  robots: { index: false, follow: false, nocache: true },
}

export default function LayoutApercuVitrineV4({ children }: { children: React.ReactNode }) {
  return (
    <div lang="fr" className={`vitrine4 ${surgena.variable} ${titres.variable} ${sections.variable} ${poppins.variable} ${ubuntu.variable} ${calSans.variable}`}>
      {children}
    </div>
  )
}
