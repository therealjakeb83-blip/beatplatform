import { chargerContactsEnrichis, nomAffichage } from '@/app/dashboard/business/_lib/contacts'
import type { ContactOption } from '../_components/BlocEditor'

// Liste légère (id + libellé) pour le sélecteur de client de l'aperçu —
// évite de faire transiter tout ContactEnrichi (RFM, préférences...) côté client.
export async function chargerContactsPourApercu(beatmakerId: string): Promise<ContactOption[]> {
  const { contacts } = await chargerContactsEnrichis(beatmakerId)
  return contacts
    .map(c => ({ id: c.id, label: `${nomAffichage(c) || c.nom || c.email} <${c.email}>` }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
