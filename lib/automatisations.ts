import { createAdminClient } from '@/utils/supabase/admin'
import { getResend } from './resend'
import { remplacerTokens, genererLienDesinscription, type Destinataire } from './mailing'
import type { BrandingBoutique } from './email-blocs'

export type TypeAutomatisation = 'bienvenue_abonnement'

// Construit un destinataire minimal à partir de la fiche client, sans les
// statistiques CRM (LTV, RFM, préférences musicales...) — celles-ci exigent une
// session utilisateur (chargerContactsEnrichis) alors que les automatisations
// tournent en contexte service_role (webhook/cron, aucun beatmaker connecté).
// Suffisant pour les 8 textes de référence de Jake, qui ne référencent que
// l'identité et la boutique — à enrichir si un futur workflow a besoin de plus.
async function chargerDestinatairePourAutomatisation(clientId: string): Promise<Destinataire | null> {
  const admin = createAdminClient()
  const { data: client } = await admin
    .from('clients')
    .select('id, prenom, surnom, nom, nom_artiste, email, pays, langue, newsletter_consent, instagram, spotify, youtube, tiktok, tags, created_at')
    .eq('id', clientId)
    .single()
  if (!client) return null

  return {
    ...client,
    langue: (client.langue === 'EN' ? 'EN' : 'FR'),
    tags: client.tags ?? [],
    statut: 'abonne',
    ltv: 0,
    nb_achats: 0,
    panier_moyen: null,
    mensualites_payees: 0,
    dernier_achat_iso: null,
    premierContactISO: client.created_at,
    pref_style: null,
    pref_type_beat: null,
    pref_ambiance: null,
    pref_instruments: null,
    pref_licence: null,
    source: null,
    score_rf: 'Occasionnel',
    score_chaleur: 'Froid',
    nb_favoris: 0,
    nb_free_downloads: 0,
  }
}

async function envoyerEmailAutomatisation(params: {
  automatisationId: string
  clientId: string
  evenementCle: string
  objet: string
  corps: string
  destinataire: Destinataire
  branding: BrandingBoutique
  beatmakerId: string
}): Promise<boolean> {
  const admin = createAdminClient()

  const lien = genererLienDesinscription(params.clientId, params.beatmakerId, params.automatisationId)
  const objet = remplacerTokens(params.objet, params.destinataire, params.branding, lien)
  const corpsHtml = remplacerTokens(params.corps, params.destinataire, params.branding, lien)
    .split('\n').map(l => `<p style="margin:0 0 1em">${l}</p>`).join('')

  const from = `${params.branding.nom_artiste} <campagnes@jakebmusic.com>`

  const { data, error } = await getResend().emails.send({
    from,
    to: params.destinataire.email,
    subject: objet,
    html: corpsHtml,
  })

  if (error || !data) {
    console.error('[automatisations] Échec envoi', params.evenementCle, ':', error)
    return false
  }

  const { error: logError } = await admin.from('automatisation_envois').insert({
    automatisation_id: params.automatisationId,
    client_id: params.clientId,
    evenement_cle: params.evenementCle,
    resend_message_id: data.id,
  })
  if (logError) console.error('[automatisations] Erreur log automatisation_envois:', JSON.stringify(logError))

  return true
}

// Traite un événement en file d'attente : charge la config, le destinataire et
// la boutique, envoie l'email si tout est prêt, puis marque l'événement traité
// (que l'envoi ait réussi ou non — un événement non-traitable ne doit pas être
// retenté indéfiniment par le cron du lendemain). Un événement pas encore
// arrivé à échéance (delai_minutes) reste en file, retenté au prochain passage.
export async function traiterEvenementAutomatisation(evenement: {
  id: string
  beatmaker_id: string
  client_id: string
  type: TypeAutomatisation
  reference_id: string
  created_at: string
}): Promise<void> {
  const admin = createAdminClient()

  const { data: automatisation } = await admin
    .from('automatisations')
    .select('id, actif, objet, corps, delai_minutes')
    .eq('beatmaker_id', evenement.beatmaker_id)
    .eq('type', evenement.type)
    .maybeSingle()

  if (!automatisation?.actif || !automatisation.objet || !automatisation.corps) {
    await admin.from('automatisation_evenements').update({ traite: true }).eq('id', evenement.id)
    return
  }

  const echeance = new Date(evenement.created_at).getTime() + automatisation.delai_minutes * 60_000
  if (Date.now() < echeance) return

  const [destinataire, brandingRes] = await Promise.all([
    chargerDestinatairePourAutomatisation(evenement.client_id),
    admin.from('beatmakers').select('nom_artiste, slug, logo_url, instagram_url').eq('id', evenement.beatmaker_id).single(),
  ])

  const branding = brandingRes.data as BrandingBoutique | null

  if (destinataire && branding) {
    await envoyerEmailAutomatisation({
      automatisationId: automatisation.id,
      clientId: evenement.client_id,
      evenementCle: `${evenement.type}:${evenement.reference_id}`,
      objet: automatisation.objet,
      corps: automatisation.corps,
      destinataire,
      branding,
      beatmakerId: evenement.beatmaker_id,
    })
  }

  await admin.from('automatisation_evenements').update({ traite: true }).eq('id', evenement.id)
}
