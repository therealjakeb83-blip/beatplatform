import crypto from 'crypto'

// Réinscription d'une adresse DÉSINSCRITE par le formulaire newsletter public
// (9d lot 3, faille 10) : rien n'est changé avant le clic sur le lien reçu par
// email, preuve que l'adresse appartient bien à la personne. Même principe
// que le lien du free download (lib/free-download.ts).

const VALIDITE_LIEN_MS = 7 * 24 * 60 * 60 * 1000

export type DemandeNewsletter = { beatmakerId: string; email: string; emisLe: number }

function signer(donnees: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET manquant dans les variables d\'environnement')
  return crypto.createHmac('sha256', secret).update(`newsletter-confirmation:${donnees}`).digest('hex')
}

export function genererJetonNewsletter(demande: Omit<DemandeNewsletter, 'emisLe'>): string {
  const donnees = Buffer.from(JSON.stringify({ ...demande, emisLe: Date.now() })).toString('base64url')
  return `${donnees}.${signer(donnees)}`
}

export function lireJetonNewsletter(jeton: string): { ok: true; demande: DemandeNewsletter } | { ok: false; raison: 'invalide' | 'expire' } {
  const [donnees, sig] = (jeton ?? '').split('.')
  if (!donnees || !sig) return { ok: false, raison: 'invalide' }
  const attendu = signer(donnees)
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) {
    return { ok: false, raison: 'invalide' }
  }
  try {
    const demande = JSON.parse(Buffer.from(donnees, 'base64url').toString('utf8')) as DemandeNewsletter
    if (!demande.beatmakerId || !demande.email) return { ok: false, raison: 'invalide' }
    if (Date.now() - demande.emisLe > VALIDITE_LIEN_MS) return { ok: false, raison: 'expire' }
    return { ok: true, demande }
  } catch {
    return { ok: false, raison: 'invalide' }
  }
}
