import crypto from 'crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { utilisateurConnecte } from '@/lib/session-serveur'
import { estRoleAdmin } from '@/lib/admin'
import { normaliserEmail } from '@/lib/email'
export { jetonLienEmail, jetonLienEmailValide, cheminLienEmail, cheminFichierCommande } from '@/lib/telechargement-lien'

// Accès à /telechargement/[commandeId] et à ses fichiers (Phase 11, 9 bis ;
// rang 9f, Lot 1). Le cookie dl_{commande} est SIGNÉ et dit QUI a confirmé
// l'accès (acheteur ou vendeur) et COMMENT (décisions 4 et 4 bis) :
// - appareil_paiement : posé par le navigateur qui vient de payer ;
// - lien_email : lien signé de l'email de confirmation (acheteur seulement) ;
// - email_tape : email de la commande tapé dans le formulaire.
// Seuls appareil_paiement, compte_acheteur et lien_email sont des preuves
// envoyables à Stripe ; vendeur et admin ne sont jamais enregistrés au journal.

export type Qui = 'acheteur' | 'vendeur' | 'admin'
export type Origine = 'appareil_paiement' | 'compte_acheteur' | 'lien_email' | 'email_tape'

export function cookieAccesTelechargement(commandeId: string): string {
  return `dl_${commandeId}`
}

// "Indéfiniment", comme le lien de l'email de confirmation — 1 an.
export const DUREE_COOKIE_ACCES = 60 * 60 * 24 * 365

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s) throw new Error('UNSUBSCRIBE_SECRET manquant dans les variables d\'environnement')
  return s
}

function signature(texte: string): string {
  return crypto.createHmac('sha256', secret()).update(texte).digest('base64url')
}

function egal(a: string, b: string): boolean {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

const CODES_QUI: Record<'acheteur' | 'vendeur', string> = { acheteur: 'a', vendeur: 'v' }
const CODES_ORIGINE: Record<Exclude<Origine, 'compte_acheteur'>, string> = { appareil_paiement: 'p', lien_email: 'l', email_tape: 'e' }

function valeurCookie(commandeId: string, qui: 'acheteur' | 'vendeur', origine: Exclude<Origine, 'compte_acheteur'>): string {
  const corps = `${CODES_QUI[qui]}${CODES_ORIGINE[origine]}`
  return `${corps}.${signature(`dl:${commandeId}:${corps}`)}`
}

function lireCookie(commandeId: string, valeur: string | undefined): { qui: 'acheteur' | 'vendeur'; origine: Origine } | null {
  if (!valeur) return null
  const [corps, sig] = valeur.split('.')
  if (!corps || !sig || corps.length !== 2) return null
  if (!egal(sig, signature(`dl:${commandeId}:${corps}`))) return null
  const qui = corps[0] === 'a' ? 'acheteur' : corps[0] === 'v' ? 'vendeur' : null
  const origine = (Object.entries(CODES_ORIGINE).find(([, c]) => c === corps[1])?.[0] ?? null) as Origine | null
  if (!qui || !origine) return null
  return { qui, origine }
}

type EcrivainCookies = { set(nom: string, valeur: string, options: Record<string, unknown>): unknown }

export function poserCookieAcces(
  cookieStore: EcrivainCookies,
  commandeId: string,
  qui: 'acheteur' | 'vendeur',
  origine: Exclude<Origine, 'compte_acheteur'>
): void {
  cookieStore.set(cookieAccesTelechargement(commandeId), valeurCookie(commandeId, qui, origine), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: DUREE_COOKIE_ACCES,
    path: `/telechargement/${commandeId}`,
    sameSite: 'lax',
  })
}

export type AccesCommande =
  | { autorise: false }
  | { autorise: true; qui: Qui; origine: Origine | null }

const RANG: Record<Origine, number> = { appareil_paiement: 4, lien_email: 3, compte_acheteur: 2, email_tape: 1 }

// Qui ouvre cette commande ? Session vendeur (collab comprise) ou admin =
// prioritaire sur tout (jamais enregistrés) ; sinon acheteur connecté ou
// cookie signé. Seul cas indétectable : un vendeur NON connecté qui tape
// volontairement l'email de l'acheteur.
export async function accesCommande(commande: {
  id: string
  beatmaker_id: string
  client_id: string | null
  acheteur_email: string | null
}): Promise<AccesCommande> {
  const admin = createAdminClient()
  const user = await utilisateurConnecte()

  let compteAcheteur = false
  if (user) {
    const [{ data: tranche }, { data: bm }] = await Promise.all([
      admin.from('commande_tranches').select('id').eq('commande_id', commande.id).eq('vendeur_id', user.id).limit(1).maybeSingle(),
      admin.from('beatmakers').select('role').eq('id', user.id).maybeSingle(),
    ])
    if (user.id === commande.beatmaker_id || tranche) return { autorise: true, qui: 'vendeur', origine: null }
    if (estRoleAdmin(bm?.role)) return { autorise: true, qui: 'admin', origine: null }
    compteAcheteur = user.id === commande.client_id ||
      (!!commande.acheteur_email && normaliserEmail(user.email) === normaliserEmail(commande.acheteur_email))
  }

  const cookieStore = await cookies()
  const cookie = lireCookie(commande.id, cookieStore.get(cookieAccesTelechargement(commande.id))?.value)
  if (cookie?.qui === 'vendeur') return { autorise: true, qui: 'vendeur', origine: null }

  const origines: Origine[] = []
  if (compteAcheteur) origines.push('compte_acheteur')
  if (cookie) origines.push(cookie.origine)
  if (!origines.length) return { autorise: false }
  origines.sort((a, b) => RANG[b] - RANG[a])
  return { autorise: true, qui: 'acheteur', origine: origines[0] }
}

// « Appareil qui a payé » (preuve) : seulement dans l'heure qui suit la
// commande. L'identifiant Stripe qui ouvre ce chemin est visible du vendeur
// dans son espace Stripe : passé ce délai, l'acheteur passe par le lien signé
// de son email, et un vendeur ne peut plus se fabriquer un accès « preuve ».
const DELAI_APPAREIL_PAIEMENT_MS = 60 * 60 * 1000

export async function poserCookieAppareilPaiement(cookieStore: EcrivainCookies, commandeId: string): Promise<void> {
  const { data } = await createAdminClient().from('commandes').select('created_at').eq('id', commandeId).maybeSingle()
  if (!data?.created_at || Date.now() - new Date(data.created_at).getTime() > DELAI_APPAREIL_PAIEMENT_MS) return
  poserCookieAcces(cookieStore, commandeId, 'acheteur', 'appareil_paiement')
}
