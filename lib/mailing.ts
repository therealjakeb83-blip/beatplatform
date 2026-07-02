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

// ── Désinscription (lien signé, pas de dépendance à un service tiers) ────────

function secretDesinscription(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET manquant dans les variables d\'environnement')
  return secret
}

export function genererLienDesinscription(clientId: string, beatmakerId: string): string {
  const payload = `${clientId}.${beatmakerId}`
  const sig = crypto.createHmac('sha256', secretDesinscription()).update(payload).digest('hex')
  const token = Buffer.from(`${payload}.${sig}`).toString('base64url')
  return `${APP_URL}/api/marketing/desinscription?token=${token}`
}

export function verifierTokenDesinscription(token: string): { clientId: string; beatmakerId: string } | null {
  try {
    const [clientId, beatmakerId, sig] = Buffer.from(token, 'base64url').toString('utf8').split('.')
    if (!clientId || !beatmakerId || !sig) return null
    const attendu = crypto.createHmac('sha256', secretDesinscription()).update(`${clientId}.${beatmakerId}`).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) return null
    return { clientId, beatmakerId }
  } catch {
    return null
  }
}

// ── Envoi d'une campagne ──────────────────────────────────────────────────────

export async function envoyerCampagne(campagneId: string): Promise<{ envoyes: number; echecs: number }> {
  const admin = createAdminClient()

  const { data: campagne } = await admin
    .from('campagnes')
    .select('id, beatmaker_id, nom, objet, contenu, cible_mode, cible_id, cible_emails, statut')
    .eq('id', campagneId)
    .single()
  if (!campagne || campagne.statut === 'envoyee' || !campagne.cible_mode) return { envoyes: 0, echecs: 0 }

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('nom_artiste, slug, logo_url, instagram_url')
    .eq('id', campagne.beatmaker_id)
    .single()
  if (!beatmaker) return { envoyes: 0, echecs: 0 }

  const branding: BrandingBoutique = beatmaker

  const cible: CibleCampagne = campagne.cible_mode === 'manuel'
    ? { mode: 'manuel', emails: campagne.cible_emails ?? [] }
    : { mode: campagne.cible_mode as 'segment' | 'liste', id: campagne.cible_id as string }

  const destinataires = await resolveDestinataires(campagne.beatmaker_id, cible)
  if (destinataires.length === 0) {
    await admin.from('campagnes').update({ statut: 'envoyee', sent_at: new Date().toISOString(), destinataires: 0 }).eq('id', campagneId)
    return { envoyes: 0, echecs: 0 }
  }

  // Un seul rendu HTML pour toute la campagne (les tokens restent en placeholders)
  const htmlBase = await rendreEmailHtml(campagne.contenu as BlocEmail[], campagne.beatmaker_id, branding)
  const from = `${beatmaker.nom_artiste} <${beatmaker.slug}@mail.myproducer.com>`

  let envoyes = 0
  let echecs = 0

  for (let i = 0; i < destinataires.length; i += LOT_TAILLE) {
    const lot = destinataires.slice(i, i + LOT_TAILLE)

    const payloads = lot.map(contact => {
      const lien = genererLienDesinscription(contact.id, campagne.beatmaker_id)
      return {
        from,
        to: contact.email,
        subject: remplacerTokens(campagne.objet ?? campagne.nom, contact, branding, lien),
        html: remplacerTokens(htmlBase, contact, branding, lien),
      }
    })

    try {
      const { data, error } = await getResend().batch.send(payloads)
      if (error || !data) {
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
    } catch {
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
