import { rendreEmailHtml, chargerBrandingBoutique, type BlocEmail, type BrandingBoutique } from '@/lib/email-blocs'
import { remplacerTokens, genererLienDesinscription } from '@/lib/mailing'
import { chargerContactsEnrichis } from '../../_lib/contacts'

// Rendu HTML d'aperçu — même moteur de rendu que l'envoi réel (lib/mailing.ts).
// Sans client sélectionné : tokens laissés en placeholders ({{prénom}}...).
// Avec un client sélectionné : tokens remplacés par ses vraies données, comme
// s'il recevait vraiment l'email (lien de désinscription factice si pas de
// campagne réelle en base — cas des templates, jamais destiné à être envoyé).
export async function construireApercu(
  beatmakerId: string,
  blocs: BlocEmail[],
  clientId?: string,
  campagneId?: string,
): Promise<string> {
  const branding: BrandingBoutique = (await chargerBrandingBoutique(beatmakerId)) ?? {
    nom_artiste: 'Ta boutique',
    slug: '',
    logo_url: null,
    instagram_url: null,
    signature_emails: null,
  }

  const htmlBase = await rendreEmailHtml(blocs, beatmakerId, branding)
  if (!clientId) return htmlBase

  const { contacts } = await chargerContactsEnrichis(beatmakerId)
  const contact = contacts.find(c => c.id === clientId)
  if (!contact) return htmlBase

  const lien = campagneId ? genererLienDesinscription(clientId, beatmakerId, campagneId, branding.adresse?.site) : '#'
  return remplacerTokens(htmlBase, contact, branding, lien)
}
