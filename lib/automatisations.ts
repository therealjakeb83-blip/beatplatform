import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique } from './email-logger'
import { remplacerTokens, genererLienDesinscription, type Destinataire } from './mailing'
import type { BrandingBoutique } from './email-blocs'

export type TypeAutomatisation = 'bienvenue_abonnement' | 'abonnement_en_attente' | 'churn_message_perso'
  | 'remerciement_1er_achat' | 'remerciement_2e_achat' | 'remerciement_3e_achat' | 'remerciement_4e_achat_plus'
  | 'bienvenue_perso' | 'relance_inactivite' | 'follow_up_free_download'
  | 'combo_1er_achat_bienvenue_abo' | 'combo_achat_recurrent_bienvenue_abo'

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
  combo_1er_achat_bienvenue_abo: 'Combo — 1er achat + Bienvenue abo',
  combo_achat_recurrent_bienvenue_abo: 'Combo — Achat récurrent + Bienvenue abo',
}

const FAMILLE_ACHAT: TypeAutomatisation[] = [
  'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus',
]
const FAMILLE_ABONNEMENT: TypeAutomatisation[] = [
  'bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso',
]
// 2 variantes de la seule vraie combo (docs/automatisations/combinaisons-5.7.md,
// décision du 2026-07-15) : le ton "1er achat" (nouvel artiste) est trop
// différent du ton "achat récurrent" (habitué) pour un texte unique — même
// logique que les 4 paliers de Remerciement achat, simplifiée à 2 puisque le
// côté abonnement de la combo est toujours "nouveau" par construction
// (bienvenue_abonnement ne se déclenche que sur un abonnement neuf).
const TYPES_COMBO_ACHAT_ABO: TypeAutomatisation[] = ['combo_1er_achat_bienvenue_abo', 'combo_achat_recurrent_bienvenue_abo']
const TOUS_TYPES_COMBO = TYPES_COMBO_ACHAT_ABO

// Un événement brut, tel que déposé par un webhook/hook/scan dans
// automatisation_evenements — voir docs/automatisations/combinaisons-5.7.md
// pour le raisonnement complet derrière tout ce fichier.
export type EvenementAutomatisation = {
  id: string
  beatmaker_id: string
  client_id: string
  type: TypeAutomatisation
  reference_id: string
  created_at: string
}

// ── Regroupement par jour (Europe/Paris) ──────────────────────────────────
// Les combinaisons se raisonnent sur le jour calendaire où l'événement a eu
// lieu (achat, abonnement...), pas sur le jour d'envoi (toujours J+1). Bucket
// Paris plutôt qu'UTC brut — cohérent avec heure_cible_minutes et avec le
// "hier" que racontent les emails.
export function jourParisISO(dateISO: string): string {
  const date = new Date(dateISO)
  const decalage = decalageMinutesParis(date)
  const equivalentParis = new Date(date.getTime() + decalage * 60_000)
  return equivalentParis.toISOString().slice(0, 10)
}

// ── Résolution "combinaisons" (docs/automatisations/combinaisons-5.7.md) ──
// Système à 2 passes, jamais plus d'1 email par client par jour :
//  Passe 1 — l'argent d'abord. Résoudre la famille Abonnement (A/B/C) toute
//  seule en un état net, PUIS la combiner avec l'achat du jour s'il y en a
//  un. Si un résultat sort de cette passe, il fait taire tout le reste.
//  Passe 2 — seulement si la passe 1 ne donne rien : Relance > Free download
//  > Bienvenue perso (Bienvenue perso reste de toute façon soumis à son
//  garde-fou absolu, vérifié séparément avant l'envoi).
// Piège identifié avec Jake (cas A+C+G) : ne jamais comparer un signal
// isolé contre un signal de la famille Abonnement pris isolément sans avoir
// d'abord figé l'état net de cette famille — un abonnement qui s'est annulé
// lui-même (silence) ne doit pas pouvoir faire taire autre chose.

export type ResolutionJournee =
  | { kind: 'rien'; evenementsSources: EvenementAutomatisation[] }
  | {
      kind: 'envoi'
      typeTemplate: TypeAutomatisation
      evenementsSources: EvenementAutomatisation[]
      // Sous-résolutions "achat seul" / "abo seul" — utilisées uniquement en
      // repli si la combo n'est pas (encore) configurée par le beatmaker.
      repliCombo?: { achat: EvenementAutomatisation[]; abonnement: EvenementAutomatisation[] }
    }

function resoudreFamilleAbonnement(evs: EvenementAutomatisation[]): {
  gagnant: EvenementAutomatisation | null
  tousLesEvenements: EvenementAutomatisation[]
} {
  const a = evs.find(e => e.type === 'bienvenue_abonnement')
  const b = evs.find(e => e.type === 'abonnement_en_attente')
  const c = evs.find(e => e.type === 'churn_message_perso')
  const tous = evs.filter(e => FAMILLE_ABONNEMENT.includes(e.type))

  // A+B : quasi impossible (le 1er renouvellement tombe toujours le mois
  // suivant) — aucune règle spécifique, on retombe sur le cas général.
  if (a && c) return { gagnant: null, tousLesEvenements: tous } // #2 — silence total, comme si rien ne s'était passé
  if (c) return { gagnant: c, tousLesEvenements: tous } // #3 — B+C ou C seul : Churn gagne, vécu réel derrière
  if (b) return { gagnant: b, tousLesEvenements: tous }
  if (a) return { gagnant: a, tousLesEvenements: tous }
  return { gagnant: null, tousLesEvenements: [] }
}

function resoudreFamilleAchat(evs: EvenementAutomatisation[]): {
  type: TypeAutomatisation
  evenements: EvenementAutomatisation[]
} | null {
  const achats = evs.filter(e => FAMILLE_ACHAT.includes(e.type)).sort((x, y) => x.created_at.localeCompare(y.created_at))
  if (achats.length === 0) return null
  // #7 — plusieurs achats le même jour : le palier du 1er de la journée (le
  // plus bas), pas le plus avancé (sinon un nouveau client recevrait le texte
  // "habitué" — incohérent). Les titres de tous les achats du jour sont
  // fusionnés au moment de résoudre les tokens, via evenementsSources.
  return { type: achats[0].type, evenements: achats }
}

function resoudrePasse1(evs: EvenementAutomatisation[]): ResolutionJournee {
  const abonnementNet = resoudreFamilleAbonnement(evs)
  const achatNet = resoudreFamilleAchat(evs)

  if (achatNet && abonnementNet.gagnant?.type === 'bienvenue_abonnement') {
    // #4 — seule vraie combo qui a survécu à la revue. 2 variantes selon le
    // palier réel de l'achat (le côté abonnement est toujours "bienvenue",
    // par construction) — décision du 2026-07-15.
    const typeCombo: TypeAutomatisation = achatNet.type === 'remerciement_1er_achat'
      ? 'combo_1er_achat_bienvenue_abo'
      : 'combo_achat_recurrent_bienvenue_abo'
    return {
      kind: 'envoi',
      typeTemplate: typeCombo,
      evenementsSources: [...achatNet.evenements, ...abonnementNet.tousLesEvenements],
      repliCombo: { achat: achatNet.evenements, abonnement: abonnementNet.tousLesEvenements },
    }
  }
  if (achatNet) {
    // #5, #6 — achat + (en attente | churn | abonnement déjà silencieux) :
    // l'achat gagne seul, priorité au positif.
    return {
      kind: 'envoi',
      typeTemplate: achatNet.type,
      evenementsSources: [...achatNet.evenements, ...abonnementNet.tousLesEvenements],
    }
  }
  if (abonnementNet.gagnant) {
    return { kind: 'envoi', typeTemplate: abonnementNet.gagnant.type, evenementsSources: abonnementNet.tousLesEvenements }
  }
  // Rien côté argent — soit une journée calme, soit un abonnement qui s'est
  // annulé lui-même (#2, A+C) : dans les deux cas on ne fait PAS taire les
  // signaux faibles à cause de ça (voir passe 2).
  return { kind: 'rien', evenementsSources: abonnementNet.tousLesEvenements }
}

function resoudrePasse2(evsFaibles: EvenementAutomatisation[]): ResolutionJournee {
  const f = evsFaibles.find(e => e.type === 'relance_inactivite')
  const g = evsFaibles.filter(e => e.type === 'follow_up_free_download')
  const e = evsFaibles.find(e => e.type === 'bienvenue_perso')

  if (f) return { kind: 'envoi', typeTemplate: 'relance_inactivite', evenementsSources: [f, ...g, ...(e ? [e] : [])] }
  // #23 — plusieurs téléchargements gratuits le même jour : un seul mail
  // fusionnant tous les titres, pas N mails.
  if (g.length > 0) return { kind: 'envoi', typeTemplate: 'follow_up_free_download', evenementsSources: [...g, ...(e ? [e] : [])] }
  if (e) return { kind: 'envoi', typeTemplate: 'bienvenue_perso', evenementsSources: [e] } // garde-fou absolu vérifié séparément
  return { kind: 'rien', evenementsSources: [] }
}

// Exportée pour l'affichage de la file d'attente (page.tsx) — pure fonction,
// pas d'accès DB, safe à appeler pour du rendu seulement (pas d'envoi ni de
// marquage traité ici).
export function resoudreJournee(evs: EvenementAutomatisation[]): ResolutionJournee {
  const passe1 = resoudrePasse1(evs)
  const evsFaibles = evs.filter(e => e.type === 'relance_inactivite' || e.type === 'follow_up_free_download' || e.type === 'bienvenue_perso')

  if (passe1.kind === 'envoi') {
    // Un résultat argent est sorti : tous les signaux faibles du jour sont
    // silencieux d'un coup, peu importe combien il y en a (#14, #15, #16-18,
    // #19-22 tombent automatiquement de cette règle, aucun cas particulier).
    return { ...passe1, evenementsSources: [...passe1.evenementsSources, ...evsFaibles] }
  }

  const passe2 = resoudrePasse2(evsFaibles)
  return { ...passe2, evenementsSources: [...passe1.evenementsSources, ...passe2.evenementsSources] } as ResolutionJournee
}

// ── Garde-fous d'état (vérifiés à l'envoi, pas au dépôt) ──────────────────

// Bienvenue perso : règle générale qui remplace le raisonnement au cas par
// cas — jamais envoyé si ce client a déjà une commande, un abonnement ou un
// téléchargement gratuit chez ce beatmaker, à n'importe quelle date.
async function clientDejaConnu(beatmakerId: string, clientId: string): Promise<boolean> {
  const admin = createAdminClient()
  const [{ count: nbCommandes }, { count: nbAbos }, { count: nbDownloads }] = await Promise.all([
    admin.from('commandes').select('id', { count: 'exact', head: true }).eq('beatmaker_id', beatmakerId).eq('client_id', clientId),
    admin.from('abonnements_boutique').select('id', { count: 'exact', head: true }).eq('beatmaker_id', beatmakerId).eq('client_id', clientId),
    admin.from('free_downloads').select('id', { count: 'exact', head: true }).eq('beatmaker_id', beatmakerId).eq('client_id', clientId),
  ])
  return (nbCommandes ?? 0) > 0 || (nbAbos ?? 0) > 0 || (nbDownloads ?? 0) > 0
}

// Abonnement en attente : re-vérifier que l'abonnement est TOUJOURS en
// attente au moment de l'envoi — si Stripe a retenté le paiement entre-temps
// et que c'est repassé, l'abonnement est redevenu actif, ne pas envoyer.
async function abonnementEncoreEnAttente(abonnementId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from('abonnements_boutique').select('statut').eq('id', abonnementId).maybeSingle()
  return data?.statut === 'impaye'
}

// Follow-up free download : exclure les téléchargements déjà achetés
// entre-temps (client_id + beat_id, écrit par le webhook Stripe à l'achat).
async function filtrerDownloadsNonAchetes(evs: EvenementAutomatisation[]): Promise<{
  actifs: EvenementAutomatisation[]
  achetesEntreTemps: EvenementAutomatisation[]
}> {
  const downloads = evs.filter(e => e.type === 'follow_up_free_download')
  if (downloads.length === 0) return { actifs: evs, achetesEntreTemps: [] }

  const admin = createAdminClient()
  const { data } = await admin.from('free_downloads').select('id, achete').in('id', downloads.map(d => d.reference_id))
  const acheteParId = new Map((data ?? []).map(d => [d.id, d.achete]))

  const achetesEntreTemps = downloads.filter(d => acheteParId.get(d.reference_id) === true)
  const idsAExclure = new Set(achetesEntreTemps.map(e => e.id))
  return { actifs: evs.filter(e => !idsAExclure.has(e.id)), achetesEntreTemps }
}

// ── Tokens supplémentaires (au-delà de {{prénom}}/boutique) ────────────────

// "Midnight Drive" / "Midnight Drive et Ocean Eyes" / "A, B et C" / au-delà de
// 3 titres, compte générique ("les 4 beats") plutôt que citer + "et N autres"
// (sonnait robotique — retour terrain de Jake). Réutilisé pour les achats ET
// les téléchargements gratuits fusionnés le même jour (#7, #23).
function formaterListeBeats(titres: string[]): string {
  const n = titres.length
  if (n === 0) return 'ce beat'
  if (n === 1) return titres[0]
  if (n === 2) return `${titres[0]} et ${titres[1]}`
  if (n === 3) return `${titres.slice(0, -1).join(', ')} et ${titres[titres.length - 1]}`
  return `les ${n} beats`
}

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

// Résout les tokens propres au template retenu, en fusionnant les données de
// TOUS les événements sources concernés (ex. titres de 3 achats du même
// jour, ou d'1 seul) — jamais un seul reference_id supposé, contrairement à
// l'ancienne version pré-5.7.
async function resoudreTokensSupplementaires(
  typeTemplate: TypeAutomatisation,
  evenementsSources: EvenementAutomatisation[],
  beatmakerId: string,
  clientId: string,
  options?: { previsualisation?: boolean },
): Promise<Record<string, string>> {
  const admin = createAdminClient()

  if (typeTemplate === 'abonnement_en_attente') {
    const aboEvenement = evenementsSources.find(e => e.type === 'abonnement_en_attente')
    if (!aboEvenement) return {}
    const [{ data: abo }, { data: beatmaker }] = await Promise.all([
      admin.from('abonnements_boutique').select('mois_consecutifs').eq('id', aboEvenement.reference_id).maybeSingle(),
      admin.from('beatmakers').select('abo_recurrence_cadeau_mois').eq('id', beatmakerId).single(),
    ])
    const recurrence = beatmaker?.abo_recurrence_cadeau_mois ?? 4
    const moisConsecutifs = abo?.mois_consecutifs ?? 0
    const moisAvantCadeau = recurrence - (moisConsecutifs % recurrence)
    return { mois_avant_cadeau: String(moisAvantCadeau) }
  }

  if (FAMILLE_ACHAT.includes(typeTemplate) || TYPES_COMBO_ACHAT_ABO.includes(typeTemplate)) {
    const commandeIds = evenementsSources.filter(e => FAMILLE_ACHAT.includes(e.type)).map(e => e.reference_id)
    if (commandeIds.length === 0) return { titre_beats: 'ce beat' }
    const { data: lignes } = await admin.from('commande_lignes').select('beats(titre)').in('commande_id', commandeIds)
    const titres = ((lignes ?? []) as unknown as { beats: { titre: string } | null }[])
      .map(l => l.beats?.titre)
      .filter((t): t is string => !!t)
    return { titre_beats: formaterListeBeats(titres) }
  }

  if (typeTemplate === 'follow_up_free_download') {
    const downloadIds = evenementsSources.filter(e => e.type === 'follow_up_free_download').map(e => e.reference_id)
    if (downloadIds.length === 0) return { titre_beat: 'ce beat' }
    const { data } = await admin.from('free_downloads').select('beats(titre)').in('id', downloadIds)
    const titres = ((data ?? []) as unknown as { beats: { titre: string } | null }[])
      .map(d => d.beats?.titre)
      .filter((t): t is string => !!t)
    return { titre_beat: formaterListeBeats(titres) }
  }

  if (typeTemplate === 'relance_inactivite') {
    const { data: automatisation } = await admin
      .from('automatisations')
      .select('config')
      .eq('beatmaker_id', beatmakerId)
      .eq('type', 'relance_inactivite')
      .maybeSingle()

    const config = automatisation?.config as Record<string, number> | null
    const pourcentage = Number(config?.pourcentage_remise) || 50
    const joursValidite = Number(config?.jours_validite_code) || 30
    const dateExpiration = new Date(Date.now() + joursValidite * 24 * 60 * 60 * 1000)
    const dateExpirationFormatee = dateExpiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    if (options?.previsualisation) {
      return { code_promo: 'APERÇU-XXXXXX', pourcentage_remise: String(pourcentage), date_expiration_code: dateExpirationFormatee }
    }

    const { data: client } = await admin.from('clients').select('email').eq('id', clientId).maybeSingle()
    const code = await creerCodePromoRelance(beatmakerId, client?.email ?? null, pourcentage, dateExpiration)

    return {
      code_promo: code ?? 'ERREUR-CODE',
      pourcentage_remise: String(pourcentage),
      date_expiration_code: dateExpirationFormatee,
    }
  }

  return {}
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

type ConfigAutomatisation = {
  id: string
  actif: boolean
  objet: string | null
  corps: string | null
  delai_heures: number
  heure_cible_minutes: number | null
}

async function chargerConfigs(beatmakerId: string, types: TypeAutomatisation[]): Promise<Map<TypeAutomatisation, ConfigAutomatisation>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('automatisations')
    .select('id, type, actif, objet, corps, delai_heures, heure_cible_minutes')
    .eq('beatmaker_id', beatmakerId)
    .in('type', types)
  const map = new Map<TypeAutomatisation, ConfigAutomatisation>()
  for (const row of (data ?? []) as (ConfigAutomatisation & { type: TypeAutomatisation })[]) {
    map.set(row.type, row)
  }
  return map
}

// Construit un destinataire minimal à partir de la fiche client, sans les
// statistiques CRM (LTV, RFM, préférences musicales...) — celles-ci exigent une
// session utilisateur (chargerContactsEnrichis) alors que les automatisations
// tournent en contexte service_role (webhook/cron, aucun beatmaker connecté).
// Suffisant pour les textes de référence de Jake, qui ne référencent que
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

function cleAntiDoublon(evenementsSources: EvenementAutomatisation[]): string {
  return evenementsSources.map(e => `${e.type}:${e.reference_id}`).sort().join('+')
}

// Envoie un seul email pour un template donné (recette normale ou combo),
// résout les tokens à partir de TOUS les événements sources concernés, log
// l'envoi. Ne marque rien traité (fait par l'appelant, qui gère aussi le
// reste du groupe — inactifs, filtrés achete, etc.)
async function envoyerPourTemplate(params: {
  config: ConfigAutomatisation
  typeTemplate: TypeAutomatisation
  evenementsSources: EvenementAutomatisation[]
  beatmakerId: string
  clientId: string
}): Promise<void> {
  if (!params.config.objet || !params.config.corps) return

  const [destinataire, brandingRes, tokensSupplementaires] = await Promise.all([
    chargerDestinatairePourAutomatisation(params.clientId),
    createAdminClient().from('beatmakers').select('nom_artiste, slug, logo_url, instagram_url, signature_emails').eq('id', params.beatmakerId).single(),
    resoudreTokensSupplementaires(params.typeTemplate, params.evenementsSources, params.beatmakerId, params.clientId),
  ])

  const branding = brandingRes.data as BrandingBoutique | null
  if (!destinataire || !branding) return

  await envoyerEmailAutomatisation({
    automatisationId: params.config.id,
    clientId: params.clientId,
    evenementCle: cleAntiDoublon(params.evenementsSources),
    objet: appliquerTokensSupplementaires(params.config.objet, tokensSupplementaires),
    corps: appliquerTokensSupplementaires(params.config.corps, tokensSupplementaires),
    destinataire,
    branding,
    beatmakerId: params.beatmakerId,
  })
}

// ── Point d'entrée principal : traite TOUT le groupe d'un client pour un
// jour donné (docs/automatisations/combinaisons-5.7.md). Remplace l'ancien
// traiterEvenementAutomatisation événement-par-événement — plus jamais plus
// d'1 email par client par jour.
export async function traiterGroupeAutomatisations(
  evenements: EvenementAutomatisation[],
  options?: { forcer?: boolean },
): Promise<void> {
  if (evenements.length === 0) return
  const admin = createAdminClient()
  const beatmakerId = evenements[0].beatmaker_id
  const clientId = evenements[0].client_id

  const typesPresents = [...new Set(evenements.map(e => e.type))]
  const configs = await chargerConfigs(beatmakerId, [...typesPresents, ...TOUS_TYPES_COMBO])

  // 1. Recettes inactives : retirées du groupe, marquées traitées tout de
  // suite (comportement identique à avant 5.7 — un beatmaker qui n'a jamais
  // activé une recette ne doit rien voir se passer).
  const actifs = evenements.filter(e => configs.get(e.type)?.actif)
  const inactifs = evenements.filter(e => !configs.get(e.type)?.actif)

  if (actifs.length === 0) {
    if (inactifs.length > 0) await marquerTraites(admin, inactifs)
    return
  }

  // 2. Échéance : attendre que TOUS les événements actifs du groupe soient
  // à échéance avant de résoudre la combinaison — sinon un événement encore
  // en attente pourrait faire pencher la résolution une fois arrivé. Garde-
  // fou de grâce (48h) : si le plus ancien traîne depuis trop longtemps
  // (ex. délais très différents entre 2 recettes), on traite quand même ce
  // qui est prêt plutôt que de bloquer indéfiniment.
  if (!options?.forcer) {
    const echeances = actifs.map(e => {
      const config = configs.get(e.type)!
      return { evenement: e, echeance: calculerEcheance(e.created_at, config.delai_heures, config.heure_cible_minutes) }
    })
    const maintenant = Date.now()
    const tousPrets = echeances.every(x => maintenant >= x.echeance.getTime())

    if (!tousPrets) {
      const plusAncienneEcheance = Math.min(...echeances.map(x => x.echeance.getTime()))
      const enGraceDepasse48h = maintenant - plusAncienneEcheance > 48 * 3_600_000
      if (!enGraceDepasse48h) {
        if (inactifs.length > 0) await marquerTraites(admin, inactifs)
        return // on retente au prochain passage du cron
      }
      // Grâce dépassée : on ne traite que ce qui est prêt maintenant, le
      // reste attend encore (retiré du groupe pour cette résolution).
      const prets = echeances.filter(x => maintenant >= x.echeance.getTime()).map(x => x.evenement)
      return traiterGroupePret(admin, beatmakerId, clientId, prets, configs, inactifs)
    }
  }

  await traiterGroupePret(admin, beatmakerId, clientId, actifs, configs, inactifs)
}

async function traiterGroupePret(
  admin: ReturnType<typeof createAdminClient>,
  beatmakerId: string,
  clientId: string,
  actifsPrets: EvenementAutomatisation[],
  configs: Map<TypeAutomatisation, ConfigAutomatisation>,
  inactifs: EvenementAutomatisation[],
): Promise<void> {
  // 3. Garde-fou follow_up_free_download : exclure les téléchargements déjà
  // achetés entre-temps — ils ne doivent influencer aucune résolution.
  const { actifs: pretsFiltres, achetesEntreTemps } = await filtrerDownloadsNonAchetes(actifsPrets)

  const resolution = resoudreJournee(pretsFiltres)
  const aTraiter = [...inactifs, ...achetesEntreTemps]

  if (resolution.kind === 'rien') {
    await marquerTraites(admin, [...resolution.evenementsSources, ...aTraiter])
    return
  }

  // 4. Garde-fous d'état supplémentaires (peuvent redescendre à 'rien')
  if (resolution.typeTemplate === 'abonnement_en_attente') {
    const aboEvenement = resolution.evenementsSources.find(e => e.type === 'abonnement_en_attente')
    if (aboEvenement && !(await abonnementEncoreEnAttente(aboEvenement.reference_id))) {
      await marquerTraites(admin, [...resolution.evenementsSources, ...aTraiter])
      return
    }
  }
  if (resolution.typeTemplate === 'bienvenue_perso') {
    if (await clientDejaConnu(beatmakerId, clientId)) {
      await marquerTraites(admin, [...resolution.evenementsSources, ...aTraiter])
      return
    }
  }

  // 5. Repli si la combo n'est pas (encore) configurée par le beatmaker :
  // l'achat gagne seul (l'argent domine, même logique que #5/#6), bienvenue
  // abo reste silencieuse — jamais 2 mails le même jour, même dans ce cas.
  // Décision Jake du 2026-07-16 (revient sur le repli "2 mails séparés" du
  // premier passage, qui violait sans discussion explicite la règle 1
  // mail/jour) — voir docs/automatisations/combinaisons-5.7.md #4.
  if (TYPES_COMBO_ACHAT_ABO.includes(resolution.typeTemplate) && resolution.repliCombo) {
    const configCombo = configs.get(resolution.typeTemplate)
    if (!configCombo?.actif || !configCombo.objet || !configCombo.corps) {
      const configAchat = configs.get(resolution.repliCombo.achat[0].type)
      if (configAchat) {
        await envoyerPourTemplate({
          config: configAchat, typeTemplate: resolution.repliCombo.achat[0].type,
          evenementsSources: resolution.repliCombo.achat, beatmakerId, clientId,
        })
      }
      await marquerTraites(admin, [...resolution.evenementsSources, ...aTraiter])
      return
    }
  }

  const config = configs.get(resolution.typeTemplate)
  if (config) {
    await envoyerPourTemplate({ config, typeTemplate: resolution.typeTemplate, evenementsSources: resolution.evenementsSources, beatmakerId, clientId })
  }

  await marquerTraites(admin, [...resolution.evenementsSources, ...aTraiter])
}

async function marquerTraites(admin: ReturnType<typeof createAdminClient>, evenements: EvenementAutomatisation[]): Promise<void> {
  const ids = [...new Set(evenements.map(e => e.id))]
  if (ids.length === 0) return
  await admin.from('automatisation_evenements').update({ traite: true }).in('id', ids)
}

// ── Aperçu (bouton "Visualiser" de la file d'attente) ──────────────────────
// Résout le groupe entier (pas juste l'événement cliqué) pour montrer le
// résultat réel qui partira — ex. cliquer "Visualiser" sur l'événement
// "abonnement en attente" d'un jour où un achat a aussi eu lieu affiche
// l'email de remerciement achat, pas le texte "en attente" qui ne partira
// jamais. Aucun effet de bord (pas d'envoi, pas de marquage traité, pas de
// vrai code promo généré).
export async function genererApercuGroupe(evenements: EvenementAutomatisation[]): Promise<{ objet: string; corpsHtml: string } | { erreur: string }> {
  if (evenements.length === 0) return { erreur: 'Aucun événement à prévisualiser.' }
  const admin = createAdminClient()
  const beatmakerId = evenements[0].beatmaker_id
  const clientId = evenements[0].client_id

  const typesPresents = [...new Set(evenements.map(e => e.type))]
  const configs = await chargerConfigs(beatmakerId, [...typesPresents, ...TOUS_TYPES_COMBO])
  const actifs = evenements.filter(e => configs.get(e.type)?.actif)
  if (actifs.length === 0) return { erreur: "Aucune des recettes concernées par ce jour n'est activée." }

  const { actifs: pretsFiltres } = await filtrerDownloadsNonAchetes(actifs)
  const resolution = resoudreJournee(pretsFiltres)

  if (resolution.kind === 'rien') {
    return { erreur: "Rien ne sera envoyé pour ce jour — l'événement est annulé ou dominé par un autre événement du même client ce jour-là." }
  }

  let typeTemplate = resolution.typeTemplate
  let evenementsSources = resolution.evenementsSources
  let config = configs.get(typeTemplate)

  // Même repli qu'à l'envoi réel : si la combo n'est pas configurée, l'achat
  // gagne seul (bienvenue abo silencieuse) — voir traiterGroupePret.
  if (TYPES_COMBO_ACHAT_ABO.includes(typeTemplate) && (!config?.actif || !config.objet || !config.corps) && resolution.repliCombo) {
    typeTemplate = resolution.repliCombo.achat[0].type
    evenementsSources = resolution.repliCombo.achat
    config = configs.get(typeTemplate)
  }

  if (!config?.objet || !config.corps) {
    return { erreur: "Cette recette n'a pas encore d'objet ou de corps enregistré." }
  }

  const [destinataire, brandingRes, tokensSupplementaires] = await Promise.all([
    chargerDestinatairePourAutomatisation(clientId),
    admin.from('beatmakers').select('nom_artiste, slug, logo_url, instagram_url, signature_emails').eq('id', beatmakerId).single(),
    resoudreTokensSupplementaires(typeTemplate, evenementsSources, beatmakerId, clientId, { previsualisation: true }),
  ])

  const branding = brandingRes.data as BrandingBoutique | null
  if (!destinataire || !branding) {
    return { erreur: 'Impossible de charger le destinataire ou la boutique.' }
  }

  const objetAvecTokens = appliquerTokensSupplementaires(config.objet, tokensSupplementaires)
  const corpsAvecTokens = appliquerTokensSupplementaires(config.corps, tokensSupplementaires)

  const objet = remplacerTokens(objetAvecTokens, destinataire, branding, '#')
  const corpsHtml = remplacerTokens(corpsAvecTokens, destinataire, branding, '#')
    .split('\n').map(l => `<p style="margin:0 0 1em">${l}</p>`).join('')

  return { objet, corpsHtml }
}
