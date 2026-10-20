// Page de maintenance d'avant lancement : cache la plateforme (accueil,
// connexion/inscription beatmaker, dashboard) tout en laissant les boutiques
// accessibles à tous. Un mot de passe (variable Vercel
// MAINTENANCE_MOT_DE_PASSE) donne une autorisation de 30 jours au navigateur.
// À couper au lancement : MAINTENANCE_ACTIVE retirée ou ≠ 'true' (étape 17).
//
// Liste des chemins FERMÉS plutôt que des chemins ouverts : tout le reste
// (boutiques /[slug], /paiement, /telechargement, /artiste, /mon-compte,
// /auth/callback, /api, /.well-known pour Apple Pay) doit continuer de marcher
// sans autorisation. Une future page côté plateforme doit être ajoutée ici.

export const COOKIE_MAINTENANCE = 'sonoo_acces'
export const DUREE_ACCES_MAINTENANCE_S = 30 * 24 * 60 * 60

const CHEMINS_FERMES_EXACTS = ['/', '/connexion', '/inscription', '/mot-de-passe-oublie', '/confirmation-compte']
const PREFIXES_FERMES = ['/dashboard', '/nouveau-mot-de-passe']

export function maintenanceActive(): boolean {
  return process.env.MAINTENANCE_ACTIVE === 'true'
}

export function cheminFermeEnMaintenance(pathname: string): boolean {
  if (CHEMINS_FERMES_EXACTS.includes(pathname)) return true
  return PREFIXES_FERMES.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

// Signé avec le mot de passe lui-même : le changer sur Vercel révoque d'un
// coup toutes les autorisations déjà données.
async function signature(valeur: string): Promise<string | null> {
  const secret = process.env.MAINTENANCE_MOT_DE_PASSE
  if (!secret) return null
  const cle = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const octets = new Uint8Array(await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(valeur)))
  return Array.from(octets, o => o.toString(16).padStart(2, '0')).join('')
}

function egaliteConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function creerJetonMaintenance(): Promise<string | null> {
  const expiration = String(Math.floor(Date.now() / 1000) + DUREE_ACCES_MAINTENANCE_S)
  const sig = await signature(expiration)
  return sig ? `${expiration}.${sig}` : null
}

export async function jetonMaintenanceValide(jeton: string | undefined): Promise<boolean> {
  if (!jeton) return false
  const [expiration, sig] = jeton.split('.')
  if (!expiration || !sig || Number(expiration) * 1000 < Date.now()) return false
  const attendue = await signature(expiration)
  return attendue !== null && egaliteConstante(sig, attendue)
}

export function motDePasseMaintenanceCorrect(saisi: string): boolean {
  const attendu = process.env.MAINTENANCE_MOT_DE_PASSE
  return !!attendu && egaliteConstante(saisi, attendu)
}

export function retourSur(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}
