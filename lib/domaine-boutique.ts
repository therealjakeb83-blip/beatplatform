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

// Page de paiement : domaine/paiement sur un domaine (proxy.ts la réécrit).
export function lienPaiement(slug: string, surDomaine: boolean, requete = ''): string {
  return `${surDomaine ? '/paiement' : `/paiement/${slug}`}${requete}`
}

// Connexion client avec retour sur la page voulue de la boutique.
export function lienConnexionArtiste(slug: string, surDomaine: boolean, chemin = ''): string {
  return `/artiste/connexion?redirect=${encodeURIComponent(lienBoutique(slug, chemin, surDomaine))}`
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

// Servies telles quelles sur le domaine (elles retrouvent la boutique par
// l'adresse, voir lib/boutique-du-domaine.ts). /paiement est réécrit à part.
const PREFIXES_DIRECTS = ['/api', '/auth', '/_next', '/.well-known', '/telechargement', '/artiste', '/robots.txt']

function commencePar(pathname: string, prefixe: string): boolean {
  return pathname === prefixe || pathname.startsWith(`${prefixe}/`)
}

export type RouteSurDomaine = 'plateforme' | 'direct' | 'paiement' | 'boutique'

export function routeSurDomaine(pathname: string): RouteSurDomaine {
  if (PREFIXES_PLATEFORME.some(p => commencePar(pathname, p))) return 'plateforme'
  if (commencePar(pathname, '/paiement')) return 'paiement'
  if (PREFIXES_DIRECTS.some(p => commencePar(pathname, p))) return 'direct'
  return 'boutique'
}

// Réponse de proxy.ts, y compris pour un domaine pas encore actif : c'est ce qui
// prouve qu'un domaine arrive réellement jusqu'à Sonoo, certificat compris.
export const CHEMIN_SONDE = '/api/domaine/sonde'
export const SIGNATURE_SONDE = 'domaine-relie'

export function estHoteSonoo(hote: string | null | undefined): boolean {
  const h = hoteSansPort(hote)
  return h === DOMAINE_PLATEFORME || h === `www.${DOMAINE_PLATEFORME}`
}

// Rang 9c bis : « lilbeat » pour lilbeat.sonoo.app, null pour tout autre hôte
// (sonoo.app, www, a.b.sonoo.app, domaine perso). Ne dit pas si la boutique existe.
export function etiquetteSousDomaine(hote: string | null | undefined): string | null {
  const h = hoteSansPort(hote)
  const suffixe = `.${DOMAINE_PLATEFORME}`
  if (!h.endsWith(suffixe)) return null
  const etiquette = h.slice(0, -suffixe.length)
  if (!etiquette || etiquette.includes('.') || etiquette === 'www') return null
  return etiquette
}

export function hoteSousDomaine(slug: string): string {
  return `${slug.toLowerCase()}.${DOMAINE_PLATEFORME}`
}

const SEGMENTS_HORS_BOUTIQUE = new Set([
  'api',
  'apercu-vitrine',
  'artiste',
  'auth',
  'confirmation-compte',
  'connexion',
  'dashboard',
  'inscription',
  'maintenance',
  'mon-compte',
  'mot-de-passe-oublie',
  'nouveau-mot-de-passe',
  'paiement',
  'telechargement',
  'verification-en-cours',
])

// Le premier morceau d'une adresse sonoo.app, s'il peut être le slug d'une boutique.
export function slugDuChemin(pathname: string): string | null {
  const segment = pathname.split('/')[1] ?? ''
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(segment) || SEGMENTS_HORS_BOUTIQUE.has(segment)) return null
  return segment
}

// Boutique d'une adresse de retour sur sonoo.app (« /slug/beats »,
// « /paiement/slug?abonnement=1 »). Sur un domaine, la boutique se lit sur
// l'adresse du site, jamais ici.
export function slugBoutiqueDuChemin(chemin: string): string | null {
  const segments = chemin.split(/[?#]/)[0].split('/').filter(Boolean)
  if (segments[0] === 'paiement') return segments[1] && slugDuChemin(`/${segments[1]}`) ? segments[1] : null
  return slugDuChemin(`/${segments[0] ?? ''}`)
}
