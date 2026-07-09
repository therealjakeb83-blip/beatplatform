import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique } from './email-logger'
import { remplacerTokens, genererLienDesinscription, type Destinataire } from './mailing'
import type { BrandingBoutique } from './email-blocs'

export type TypeAutomatisation = 'bienvenue_abonnement' | 'abonnement_en_attente' | 'churn_message_perso'
  | 'remerciement_1er_achat' | 'remerciement_2e_achat' | 'remerciement_3e_achat' | 'remerciement_4e_achat_plus'
  | 'bienvenue_perso' | 'relance_inactivite' | 'follow_up_free_download' | 'follow_up_favori'

export const LABELS_AUTOMATISATION: Record<TypeAutomatisation, string> = {
  bienvenue_abonnement: 'Bienvenue abonnement',
  abonnement_en_attente: 'Abonnement en attente',
  churn_message_perso: 'Churn message perso',
  remerciement_1er_achat: 'Remerciement achat — 1er achat',
  remerciement_2e_achat: 'Remerciement achat — 2e achat',
  remerciement_3e_achat: 'Remerciement achat — 3e achat',
  remerciement_4e_achat_plus: 'Remerciement achat — 4e achat et +',
  bienvenue_perso: 'Bienvenue perso',
  relance_inactivite: 'Relance inactivité',
  follow_up_free_download: 'Follow-up free download',
  follow_up_favori: 'Follow-up favori',
}

const TYPES_REMERCIEMENT_ACHAT: TypeAutomatisation[] = [
  'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus',
]

// Vérifie qu'une recette est activée avant même de déposer un événement dans
// la file d'attente — un beatmaker qui n'a jamais activé une recette ne doit
// rien y voir apparaître (choix produit de Jake, 2026-07-08). Partagé entre
// tous les points de dépôt (webhook Stripe, liaison de compte, crons de scan).
export async function automatisationActive(beatmakerId: string, type: TypeAutomatisation): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('automatisations')
    .select('actif')
    .eq('beatmaker_id', beatmakerId)
    .eq('type', type)
    .maybeSingle()
  return data?.actif ?? false
}

// Tokens propres à un type d'automatisation (pas partagés avec le système de
// tokens générique de lib/mailing.ts, qui ne connaît que le contact/la
// boutique) — ex. le nombre de mois avant le prochain beat cadeau, qui dépend
// de l'abonnement précis concerné par l'événement, pas juste du client.
async function resoudreTokensSupplementaires(evenement: {
  type: TypeAutomatisation
  reference_id: string
  beatmaker_id: string
  client_id: string
}, options?: { previsualisation?: boolean }): Promise<Record<string, string>> {
  const admin = createAdminClient()

  if (evenement.type === 'abonnement_en_attente') {
    const [{ data: abo }, { data: beatmaker }] = await Promise.all([
      admin.from('abonnements_boutique').select('mois_consecutifs').eq('id', evenement.reference_id).maybeSingle(),
      admin.from('beatmakers').select('abo_recurrence_cadeau_mois').eq('id', evenement.beatmaker_id).single(),
    ])

    const recurrence = beatmaker?.abo_recurrence_cadeau_mois ?? 4
    const moisConsecutifs = abo?.mois_consecutifs ?? 0
    const moisAvantCadeau = recurrence - (moisConsecutifs % recurrence)

    return { mois_avant_cadeau: String(moisAvantCadeau) }
  }

  if (TYPES_REMERCIEMENT_ACHAT.includes(evenement.type)) {
    // Depuis Phase 2c (panier multi-articles), 1 commande peut couvrir
    // plusieurs beats — on nomme les titres achetés plutôt qu'un générique
    // "le beat"/"les beats", plus personnel (voulu par Jake).
    const { data: lignes } = await admin
      .from('commande_lignes')
      .select('beats(titre)')
      .eq('commande_id', evenement.reference_id)

    const titres = ((lignes ?? []) as unknown as { beats: { titre: string } | null }[])
      .map(l => l.beats?.titre)
      .filter((t): t is string => !!t)

    return { titre_beats: formaterListeBeats(titres) }
  }

  if (evenement.type === 'follow_up_free_download') {
    const { data } = await admin.from('free_downloads').select('beats(titre)').eq('id', evenement.reference_id).maybeSingle()
    const titre = (data as unknown as { beats: { titre: string } | null } | null)?.beats?.titre
    return { titre_beat: titre ?? 'ce beat' }
  }

  if (evenement.type === 'follow_up_favori') {
    const { data } = await admin.from('favoris').select('beats(titre)').eq('id', evenement.reference_id).maybeSingle()
    const titre = (data as unknown as { beats: { titre: string } | null } | null)?.beats?.titre
    return { titre_beat: titre ?? 'ce beat' }
  }

  if (evenement.type === 'relance_inactivite') {
    const { data: automatisation } = await admin
      .from('automatisations')
      .select('config')
      .eq('beatmaker_id', evenement.beatmaker_id)
      .eq('type', 'relance_inactivite')
      .maybeSingle()

    const pourcentage = Number((automatisation?.config as Record<string, number> | null)?.pourcentage_remise) || 50
    const dateExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const dateExpirationFormatee = dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    // Aperçu : ne jamais créer de vrai code promo pour une simple prévisualisation
    // (le bouton Visualiser peut être cliqué plusieurs fois sans effet de bord).
    if (options?.previsualisation) {
      return { code_promo: 'APERÇU-XXXXXX', pourcentage_remise: String(pourcentage), date_expiration_code: dateExpirationFormatee }
    }

    const { data: client } = await admin.from('clients').select('email').eq('id', evenement.client_id).maybeSingle()
    const code = await creerCodePromoRelance(evenement.beatmaker_id, client?.email ?? null, pourcentage, dateExpiration)

    return {
      code_promo: code ?? 'ERREUR-CODE',
      pourcentage_remise: String(pourcentage),
      date_expiration_code: dateExpirationFormatee,
    }
  }

  return {}
}

// Génère un code promo personnel pour relancer un client inactif — réservé à
// son email (emails_autorises), usage unique, valable 30 jours. Créé
// uniquement au moment de l'envoi réel (pas à la prévisualisation) : appelé
// une seule fois par événement dans le fonctionnement normal (un événement
// traité disparaît de la file, "Exécuter maintenant" ne peut plus le rejouer).
async function creerCodePromoRelance(
  beatmakerId: string,
  clientEmail: string | null,
  pourcentage: number,
  dateExpiration: Date,
): Promise<string | null> {
  const admin = createAdminClient()
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

  for (let tentative = 0; tentative < 5; tentative++) {
    let code = 'RETOUR-'
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]

    const { error } = await admin.from('codes_promo').insert({
      beatmaker_id: beatmakerId,
      code,
      description: 'Relance inactivité (généré automatiquement)',
      type_remise: 'panier',
      type_valeur: 'pourcentage',
      valeur: pourcentage,
      date_expiration: dateExpiration.toISOString(),
      statut: 'actif',
      limite_par_utilisateur: 1,
      emails_autorises: clientEmail ? [clientEmail] : [],
    })

    if (!error) return code
    if (error.code !== '23505') {
      console.error('[automatisations] Erreur création code promo relance:', JSON.stringify(error))
      return null
    }
  }

  console.error('[automatisations] Échec génération code promo relance après 5 tentatives (collisions)')
  return null
}

// Garde-fous type-spécifiques : certains événements ne doivent plus partir si
// la situation a changé entre le dépôt et l'envoi (J+1) — ex. le client a
// déjà acheté le beat qu'il venait de favori/télécharger gratuitement, ou un
// achat/abonnement est arrivé le même jour que la création du compte (le
// message "bienvenue perso" grillerait l'effet du remerciement d'achat, voir
// règle de suppression Phase 5).
async function doitEtreIgnore(evenement: {
  type: TypeAutomatisation
  reference_id: string
  client_id: string
  beatmaker_id: string
  created_at: string
}): Promise<boolean> {
  const admin = createAdminClient()

  if (evenement.type === 'bienvenue_perso') {
    const jour = evenement.created_at.slice(0, 10)
    const debut = `${jour}T00:00:00.000Z`
    const fin = `${jour}T23:59:59.999Z`
    const [{ count: nbCommandes }, { count: nbAbos }] = await Promise.all([
      admin.from('commandes').select('id', { count: 'exact', head: true })
        .eq('client_id', evenement.client_id).eq('beatmaker_id', evenement.beatmaker_id)
        .gte('created_at', debut).lte('created_at', fin),
      admin.from('abonnements_boutique').select('id', { count: 'exact', head: true })
        .eq('client_id', evenement.client_id).eq('beatmaker_id', evenement.beatmaker_id)
        .gte('date_debut', debut).lte('date_debut', fin),
    ])
    return (nbCommandes ?? 0) > 0 || (nbAbos ?? 0) > 0
  }

  if (evenement.type === 'follow_up_free_download') {
    const { data } = await admin.from('free_downloads').select('achete').eq('id', evenement.reference_id).maybeSingle()
    return data?.achete === true
  }

  if (evenement.type === 'follow_up_favori') {
    const { data: favori } = await admin.from('favoris').select('client_id, beat_id').eq('id', evenement.reference_id).maybeSingle()
    if (!favori) return true // défavori entre-temps
    const { count } = await admin
      .from('commande_lignes')
      .select('id, commandes!inner(client_id)', { count: 'exact', head: true })
      .eq('beat_id', favori.beat_id)
      .eq('commandes.client_id', favori.client_id)
    return (count ?? 0) > 0
  }

  return false
}

// "Midnight Drive" / "Midnight Drive et Ocean Eyes" / "A, B et C" / au-delà de
// 3 titres, compte générique ("les 4 beats") plutôt que citer + "et N autres"
// (sonnait robotique — retour terrain de Jake).
function formaterListeBeats(titres: string[]): string {
  const n = titres.length
  if (n === 0) return 'ce beat'
  if (n === 1) return titres[0]
  if (n === 2) return `${titres[0]} et ${titres[1]}`
  if (n === 3) return `${titres.slice(0, -1).join(', ')} et ${titres[titres.length - 1]}`
  // Au-delà de 3, citer chaque titre + "et N autres" sonnait robotique
  // (retour terrain de Jake) — on bascule sur un compte générique.
  return `les ${n} beats`
}

function appliquerTokensSupplementaires(texte: string, tokens: Record<string, string>): string {
  let out = texte
  for (const [cle, valeur] of Object.entries(tokens)) {
    out = out.replaceAll(`{{${cle}}}`, valeur)
  }
  return out
}

// ── Échéance d'envoi (reprend la mécanique de la boutique perso de Jake) ──────
// attendre au moins delaiHeures après l'événement, PUIS envoyer à la prochaine
// occurrence de heureCibleMinutes en heure de Paris (615 = 10h15). Si
// heureCibleMinutes est absent (mode test), l'échéance est juste delaiHeures
// après l'événement, sans alignement sur une heure fixe.

function decalageMinutesParis(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const val = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const commeUTC = Date.UTC(val('year'), val('month') - 1, val('day'), val('hour'), val('minute'), val('second'))
  return Math.round((commeUTC - date.getTime()) / 60_000)
}

function prochaineOccurrenceParis(auPlusTot: Date, heureCibleMinutes: number): Date {
  const decalage = decalageMinutesParis(auPlusTot)
  const equivalentParis = new Date(auPlusTot.getTime() + decalage * 60_000)
  const minuitParis = Date.UTC(equivalentParis.getUTCFullYear(), equivalentParis.getUTCMonth(), equivalentParis.getUTCDate())
  let candidat = minuitParis + heureCibleMinutes * 60_000 - decalage * 60_000
  if (candidat < auPlusTot.getTime()) candidat += 24 * 60 * 60_000
  return new Date(candidat)
}

export function calculerEcheance(evenementCreeLe: string, delaiHeures: number, heureCibleMinutes: number | null): Date {
  const auPlusTot = new Date(new Date(evenementCreeLe).getTime() + delaiHeures * 3_600_000)
  return heureCibleMinutes != null ? prochaineOccurrenceParis(auPlusTot, heureCibleMinutes) : auPlusTot
}

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

// Aperçu — construit l'objet/corps résolus (tokens remplacés) sans envoyer ni
// journaliser, pour prévisualiser un événement en file d'attente avant qu'il
// ne parte réellement. Pas de vrai lien de désinscription (pas encore
// envoyé) : placeholder inerte.
export async function genererApercuAutomatisation(evenement: {
  beatmaker_id: string
  client_id: string
  type: TypeAutomatisation
  reference_id: string
}): Promise<{ objet: string; corpsHtml: string } | { erreur: string }> {
  const admin = createAdminClient()

  const { data: automatisation } = await admin
    .from('automatisations')
    .select('objet, corps')
    .eq('beatmaker_id', evenement.beatmaker_id)
    .eq('type', evenement.type)
    .maybeSingle()

  if (!automatisation?.objet || !automatisation.corps) {
    return { erreur: "Cette recette n'a pas encore d'objet ou de corps enregistré." }
  }

  const [destinataire, brandingRes, tokensSupplementaires] = await Promise.all([
    chargerDestinatairePourAutomatisation(evenement.client_id),
    admin.from('beatmakers').select('nom_artiste, slug, logo_url, instagram_url').eq('id', evenement.beatmaker_id).single(),
    resoudreTokensSupplementaires(evenement, { previsualisation: true }),
  ])

  const branding = brandingRes.data as BrandingBoutique | null
  if (!destinataire || !branding) {
    return { erreur: 'Impossible de charger le destinataire ou la boutique.' }
  }

  const objetAvecTokens = appliquerTokensSupplementaires(automatisation.objet, tokensSupplementaires)
  const corpsAvecTokens = appliquerTokensSupplementaires(automatisation.corps, tokensSupplementaires)

  const objet = remplacerTokens(objetAvecTokens, destinataire, branding, '#')
  const corpsHtml = remplacerTokens(corpsAvecTokens, destinataire, branding, '#')
    .split('\n').map(l => `<p style="margin:0 0 1em">${l}</p>`).join('')

  return { objet, corpsHtml }
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

  const { data, error } = await envoyerEmailUnique({
    beatmakerId: params.beatmakerId,
    type: 'automatisation',
    evenement: `automatisation_${params.evenementCle.split(':')[0]}`,
    automatisationId: params.automatisationId,
    clientId: params.clientId,
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
// la boutique, envoie l'email si l'échéance est atteinte, puis marque
// l'événement traité (que l'envoi ait réussi ou non — un événement
// non-traitable ne doit pas être retenté indéfiniment). Un événement pas
// encore à échéance reste en file, retenté au prochain passage du cron.
export async function traiterEvenementAutomatisation(evenement: {
  id: string
  beatmaker_id: string
  client_id: string
  type: TypeAutomatisation
  reference_id: string
  created_at: string
}, options?: { forcer?: boolean }): Promise<void> {
  const admin = createAdminClient()

  const { data: automatisation } = await admin
    .from('automatisations')
    .select('id, actif, objet, corps, delai_heures, heure_cible_minutes')
    .eq('beatmaker_id', evenement.beatmaker_id)
    .eq('type', evenement.type)
    .maybeSingle()

  if (!automatisation?.actif || !automatisation.objet || !automatisation.corps) {
    await admin.from('automatisation_evenements').update({ traite: true }).eq('id', evenement.id)
    return
  }

  const echeance = calculerEcheance(evenement.created_at, automatisation.delai_heures, automatisation.heure_cible_minutes)
  if (!options?.forcer && Date.now() < echeance.getTime()) return

  if (await doitEtreIgnore(evenement)) {
    await admin.from('automatisation_evenements').update({ traite: true }).eq('id', evenement.id)
    return
  }

  const [destinataire, brandingRes, tokensSupplementaires] = await Promise.all([
    chargerDestinatairePourAutomatisation(evenement.client_id),
    admin.from('beatmakers').select('nom_artiste, slug, logo_url, instagram_url').eq('id', evenement.beatmaker_id).single(),
    resoudreTokensSupplementaires(evenement),
  ])

  const branding = brandingRes.data as BrandingBoutique | null

  if (destinataire && branding) {
    await envoyerEmailAutomatisation({
      automatisationId: automatisation.id,
      clientId: evenement.client_id,
      evenementCle: `${evenement.type}:${evenement.reference_id}`,
      objet: appliquerTokensSupplementaires(automatisation.objet, tokensSupplementaires),
      corps: appliquerTokensSupplementaires(automatisation.corps, tokensSupplementaires),
      destinataire,
      branding,
      beatmakerId: evenement.beatmaker_id,
    })
  }

  await admin.from('automatisation_evenements').update({ traite: true }).eq('id', evenement.id)
}
