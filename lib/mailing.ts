import crypto from 'crypto'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getResend } from './resend'
import { rendreEmailHtml, type BlocEmail, type BrandingBoutique } from './email-blocs'
import { chargerContactsEnrichis, nomAffichage, type ContactEnrichi } from '@/app/dashboard/business/_lib/contacts'
import { evaluerFiltres, type Condition } from '@/app/dashboard/business/_lib/segments'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-producer.com'
const LOT_TAILLE = 100 // limite du batch send Resend

export type CibleCampagne =
  | { mode: 'segment'; id: string }
  | { mode: 'liste'; id: string }
  | { mode: 'manuel'; emails: string[] }

export type Destinataire = ContactEnrichi

// ── Ciblage : résout une cible (segment/liste/manuel) en liste de contacts consentants ──

export async function resolveDestinataires(beatmakerId: string, cible: CibleCampagne): Promise<Destinataire[]> {
  const { contacts } = await chargerContactsEnrichis(beatmakerId)
  const consentants = contacts.filter(c => c.newsletter_consent)

  if (cible.mode === 'segment') {
    const supabase = await createServerClient()
    const { data: segment } = await supabase
      .from('segments_crm')
      .select('filtres')
      .eq('id', cible.id)
      .eq('beatmaker_id', beatmakerId)
      .single()
    if (!segment) return []
    const filtres = segment.filtres as Condition[]
    return consentants.filter(c => evaluerFiltres(c, filtres))
  }

  if (cible.mode === 'liste') {
    const supabase = await createServerClient()
    const { data: liste } = await supabase
      .from('listes_crm')
      .select('id')
      .eq('id', cible.id)
      .eq('beatmaker_id', beatmakerId)
      .single()
    if (!liste) return []
    const admin = createAdminClient()
    const { data: membres } = await admin.from('listes_crm_contacts').select('client_id').eq('liste_id', cible.id)
    const ids = new Set((membres ?? []).map(m => m.client_id))
    return consentants.filter(c => ids.has(c.id))
  }

  // Manuel : ne garde que les emails saisis qui correspondent à des contacts connus et consentants
  // (impossible de vérifier le consentement RGPD d'une adresse inconnue en base)
  const emails = new Set(cible.emails.map(e => e.trim().toLowerCase()))
  return consentants.filter(c => emails.has(c.email.toLowerCase()))
}

// ── Tokens de personnalisation ────────────────────────────────────────────────

export function remplacerTokens(
  texte: string,
  contact: Destinataire,
  branding: BrandingBoutique,
  lienDesinscription?: string,
): string {
  return texte
    .replace(/\{\{\s*prénom\s*\}\}/gi, nomAffichage(contact) || 'là')
    .replace(/\{\{\s*nom\s*\}\}/gi, contact.nom ?? '')
    .replace(/\{\{\s*email\s*\}\}/gi, contact.email)
    .replace(/\{\{\s*style_préféré\s*\}\}/gi, contact.pref_style ?? '')
    .replace(/\{\{\s*type_beat_préféré\s*\}\}/gi, contact.pref_type_beat ?? '')
    .replace(/\{\{\s*nom_boutique\s*\}\}/gi, branding.nom_artiste)
    .replace(/\{\{\s*url_boutique\s*\}\}/gi, `${APP_URL}/${branding.slug}`)
    .replace(/\{\{\s*slug_boutique\s*\}\}/gi, branding.slug)
    .replace(/\{\{\s*lien_desinscription\s*\}\}/gi, lienDesinscription ?? '')
}

// ── Jeton signé (clientId.beatmakerId.campagneId) ────────────────────────────
// Partagé par la désinscription et le suivi de clic — pas de dépendance à un
// service tiers, seule cette clé permet de générer un jeton valide.

function secretToken(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET manquant dans les variables d\'environnement')
  return secret
}

export function genererToken(clientId: string, beatmakerId: string, campagneId: string): string {
  const payload = `${clientId}.${beatmakerId}.${campagneId}`
  const sig = crypto.createHmac('sha256', secretToken()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifierTokenCampagne(token: string): { clientId: string; beatmakerId: string; campagneId: string } | null {
  try {
    const [clientId, beatmakerId, campagneId, sig] = Buffer.from(token, 'base64url').toString('utf8').split('.')
    if (!clientId || !beatmakerId || !campagneId || !sig) return null
    const attendu = crypto.createHmac('sha256', secretToken()).update(`${clientId}.${beatmakerId}.${campagneId}`).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) return null
    return { clientId, beatmakerId, campagneId }
  } catch {
    return null
  }
}

export function genererLienDesinscription(clientId: string, beatmakerId: string, campagneId: string): string {
  const token = genererToken(clientId, beatmakerId, campagneId)
  return `${APP_URL}/api/marketing/desinscription?token=${token}`
}

// Lien de suivi de clic : fait transiter le destinataire par notre propre redirection
// avant la vraie destination, pour savoir précisément qui a cliqué depuis quelle
// campagne — indépendamment de l'email utilisé plus tard au paiement.
export function genererLienClic(clientId: string, beatmakerId: string, campagneId: string, urlCible: string): string {
  const token = genererToken(clientId, beatmakerId, campagneId)
  return `${APP_URL}/api/marketing/clic?token=${token}&url=${encodeURIComponent(urlCible)}`
}

// Enveloppe tous les liens absolus vers l'app (sauf ceux déjà routés vers /api/marketing/)
// dans le lien de suivi de clic — appelé une fois par destinataire après remplacerTokens().
export function envelopperLiensSuivi(html: string, clientId: string, beatmakerId: string, campagneId: string): string {
  const prefixe = `href="${APP_URL}`
  return html.split(prefixe).map((segment, i) => {
    if (i === 0) return segment
    const finGuillemet = segment.indexOf('"')
    if (finGuillemet === -1) return prefixe + segment
    const urlCible = APP_URL + segment.slice(0, finGuillemet)
    if (urlCible.includes('/api/marketing/')) return prefixe + segment
    return `href="${genererLienClic(clientId, beatmakerId, campagneId, urlCible)}"` + segment.slice(finGuillemet + 1)
  }).join('')
}

export const COOKIE_CLIC = 'mp_click'

// ── Compteurs agrégés sur `campagnes` (ouvertures/clics/desinscrits/conversions) ─

export async function incrementerCompteurCampagne(
  campagneId: string,
  champ: 'ouvertures' | 'clics' | 'desinscrits' | 'conversions',
): Promise<void> {
  const admin = createAdminClient()
  const { data: campagne } = await admin.from('campagnes').select(champ).eq('id', campagneId).single()
  if (!campagne) return
  const valeur = (campagne as Record<string, number>)[champ]
  await admin.from('campagnes').update({ [champ]: valeur + 1 }).eq('id', campagneId)
}

// Durée de vie du cookie de suivi de clic — au-delà, un achat n'est plus attribué
export const FENETRE_CONVERSION_JOURS = 30

// Attribution par clic : appelée uniquement si l'acheteur a un cookie de suivi
// valide (posé lors du clic sur un lien de la campagne) — jamais par simple
// correspondance d'email, pour éviter de créditer un achat direct sans rapport.
export async function enregistrerConversionParClic(campagneId: string, clientId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: envoi } = await admin
    .from('campagne_envois')
    .select('id, converti_at')
    .eq('campagne_id', campagneId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!envoi || envoi.converti_at) return

  await admin.from('campagne_envois').update({ converti_at: new Date().toISOString() }).eq('id', envoi.id)
  await incrementerCompteurCampagne(campagneId, 'conversions')
}

// ── Envoi d'une campagne ──────────────────────────────────────────────────────

export type ResultatEnvoi = { envoyes: number; echecs: number; raison?: 'sans_ciblage' | 'aucun_destinataire' }

export async function envoyerCampagne(campagneId: string): Promise<ResultatEnvoi> {
  console.log('[mailing] envoyerCampagne démarré pour', campagneId)
  const admin = createAdminClient()

  const { data: campagne, error: campagneError } = await admin
    .from('campagnes')
    .select('id, beatmaker_id, nom, objet, contenu, cible_mode, cible_id, cible_emails, statut')
    .eq('id', campagneId)
    .single()
  if (campagneError) console.error('[mailing] Erreur lecture campagne', campagneId, ':', campagneError)
  if (!campagne || campagne.statut === 'envoyee') {
    console.log('[mailing] Arrêt : campagne introuvable ou déjà envoyée', { campagneId, trouvee: !!campagne, statut: campagne?.statut })
    return { envoyes: 0, echecs: 0 }
  }
  console.log('[mailing] Campagne chargée', { cible_mode: campagne.cible_mode, cible_id: campagne.cible_id, nbBlocs: Array.isArray(campagne.contenu) ? campagne.contenu.length : 'non-array' })
  if (!campagne.cible_mode) return { envoyes: 0, echecs: 0, raison: 'sans_ciblage' }

  const { data: beatmaker, error: beatmakerError } = await admin
    .from('beatmakers')
    .select('nom_artiste, slug, logo_url, instagram_url')
    .eq('id', campagne.beatmaker_id)
    .single()
  if (beatmakerError) console.error('[mailing] Erreur lecture beatmaker', campagne.beatmaker_id, ':', beatmakerError)
  if (!beatmaker) return { envoyes: 0, echecs: 0, raison: 'sans_ciblage' }

  const branding: BrandingBoutique = beatmaker

  const cible: CibleCampagne = campagne.cible_mode === 'manuel'
    ? { mode: 'manuel', emails: campagne.cible_emails ?? [] }
    : { mode: campagne.cible_mode as 'segment' | 'liste', id: campagne.cible_id as string }

  const destinataires = await resolveDestinataires(campagne.beatmaker_id, cible)
  console.log('[mailing] Destinataires résolus :', destinataires.length)
  if (destinataires.length === 0) {
    // Pas de destinataire valide (segment/liste vide, ou personne inscrit à la newsletter) —
    // on ne touche pas au statut pour que le beatmaker puisse corriger le ciblage et réessayer.
    return { envoyes: 0, echecs: 0, raison: 'aucun_destinataire' }
  }

  // Un seul rendu HTML pour toute la campagne (les tokens restent en placeholders)
  const htmlBase = await rendreEmailHtml(campagne.contenu as BlocEmail[], campagne.beatmaker_id, branding)

  // Domaine d'envoi par boutique ([slug]@mail.myproducer.com) prévu en 4.5, pas encore
  // configuré côté Resend. En attendant, on envoie depuis le domaine déjà vérifié
  // (le même que lib/emails.ts) pour que les campagnes fonctionnent dès maintenant.
  const from = `${beatmaker.nom_artiste} <campagnes@jakebmusic.com>`

  let envoyes = 0
  let echecs = 0

  for (let i = 0; i < destinataires.length; i += LOT_TAILLE) {
    const lot = destinataires.slice(i, i + LOT_TAILLE)

    try {
      const payloads = lot.map(contact => {
        const lien = genererLienDesinscription(contact.id, campagne.beatmaker_id, campagneId)
        const htmlPersonnalise = remplacerTokens(htmlBase, contact, branding, lien)
        return {
          from,
          to: contact.email,
          subject: remplacerTokens(campagne.objet ?? campagne.nom, contact, branding, lien),
          html: envelopperLiensSuivi(htmlPersonnalise, contact.id, campagne.beatmaker_id, campagneId),
        }
      })

      const { data, error } = await getResend().batch.send(payloads)
      if (error || !data) {
        console.error('[mailing] Échec envoi Resend pour la campagne', campagneId, ':', error)
        echecs += lot.length
        continue
      }
      const envoisRows = lot.map((contact, idx) => ({
        campagne_id: campagneId,
        client_id: contact.id,
        resend_message_id: data.data[idx]?.id ?? null,
      }))
      await admin.from('campagne_envois').insert(envoisRows)
      envoyes += lot.length
    } catch (err) {
      console.error('[mailing] Exception envoi campagne', campagneId, ':', err)
      echecs += lot.length
    }
  }

  await admin.from('campagnes').update({
    statut: 'envoyee',
    sent_at: new Date().toISOString(),
    destinataires: envoyes,
  }).eq('id', campagneId)

  return { envoyes, echecs }
}
