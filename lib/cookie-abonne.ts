import crypto from 'crypto'

// Cookie « abonné reconnu » d'une boutique (posé après un abonnement payé).
// Il contenait l'email en clair : n'importe qui pouvait le fabriquer avec
// l'email d'un abonné et voir ses achats/factures, annuler son abonnement ou
// ouvrir son portail Stripe (faille trouvée le 2026-11-12, rang 9d lot 0).
// Désormais signé : email + signature secrète liée à la boutique.

type LecteurCookies = { get(nom: string): { value: string } | undefined }
type EcrivainCookies = { set(nom: string, valeur: string, options: Record<string, unknown>): unknown }

export function nomCookieAbonne(slug: string): string {
  return `abo_${slug}`
}

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s) throw new Error('UNSUBSCRIBE_SECRET manquant dans les variables d\'environnement')
  return s
}

function signer(slug: string, email: string): string {
  return crypto.createHmac('sha256', secret()).update(`abonne:${slug}:${email}`).digest('hex')
}

export function valeurCookieAbonne(slug: string, email: string): string {
  const emailNorm = email.trim().toLowerCase()
  return `${Buffer.from(emailNorm).toString('base64url')}.${signer(slug, emailNorm)}`
}

// Email de l'abonné si le cookie est authentique, sinon null (cookie absent,
// fabriqué, ancien format en clair, ou signé pour une autre boutique).
export function lireEmailCookieAbonne(cookies: LecteurCookies, slug: string): string | null {
  const valeur = cookies.get(nomCookieAbonne(slug))?.value
  if (!valeur) return null
  const point = valeur.lastIndexOf('.')
  if (point <= 0) return null
  const sig = valeur.slice(point + 1)
  let email: string
  try {
    email = Buffer.from(valeur.slice(0, point), 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (!email || !email.includes('@')) return null
  const attendu = signer(slug, email)
  if (sig.length !== attendu.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) return null
  return email
}

export function poserCookieAbonne(cookies: EcrivainCookies, slug: string, email: string): void {
  cookies.set(nomCookieAbonne(slug), valeurCookieAbonne(slug, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })
}
