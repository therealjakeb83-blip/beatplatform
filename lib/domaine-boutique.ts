// Domaine personnalisé par boutique : règles pures (sans accès réseau), partagées
// par proxy.ts, les pages serveur et les composants du navigateur.

import { DOMAINE_PLATEFORME } from '@/lib/constantes'

export function hoteSansPort(hote: string | null | undefined): string {
  return (hote ?? '').trim().toLowerCase().replace(/:\d+$/, '')
}

// Hôte vide = chemin habituel : mieux vaut ne rien changer que de chercher une boutique.
export function estHotePlateforme(hote: string | null | undefined): boolean {
  const h = hoteSansPort(hote)
  return (
    h === '' ||
    h === DOMAINE_PLATEFORME ||
    h === `www.${DOMAINE_PLATEFORME}` ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.endsWith('.vercel.app')
  )
}

// `chemin` : '' (accueil), '/beats', '#styles'... Commence par '/' ou '#' ou '?'.
export function lienBoutique(slug: string, chemin: string, surDomaine: boolean): string {
  if (!surDomaine) return `/${slug}${chemin}`
  return chemin.startsWith('/') ? chemin : `/${chemin}`
}

const PREFIXES_PLATEFORME = [
  '/dashboard',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/nouveau-mot-de-passe',
  '/confirmation-compte',
  '/maintenance',
  '/verification-en-cours',
]

// /paiement, /telechargement et /artiste : traités au lot 3, laissés tels quels d'ici là.
const PREFIXES_DIRECTS = ['/api', '/auth', '/_next', '/.well-known', '/paiement', '/telechargement', '/artiste']

function commencePar(pathname: string, prefixe: string): boolean {
  return pathname === prefixe || pathname.startsWith(`${prefixe}/`)
}

export type RouteSurDomaine = 'plateforme' | 'direct' | 'boutique'

export function routeSurDomaine(pathname: string): RouteSurDomaine {
  if (PREFIXES_PLATEFORME.some(p => commencePar(pathname, p))) return 'plateforme'
  if (PREFIXES_DIRECTS.some(p => commencePar(pathname, p))) return 'direct'
  return 'boutique'
}
