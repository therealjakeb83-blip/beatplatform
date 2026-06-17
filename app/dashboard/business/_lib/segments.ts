// ── Types ──────────────────────────────────────────────────────────────────────

export type BadgeCondition = {
  champ: 'score_rf' | 'score_chaleur'
  op: 'eq' | 'neq' | 'any'
  vals: string[]
}

export type Condition = {
  lien?: 'ET' | 'OU'
  champ: string
  op: 'eq' | 'neq' | 'gte' | 'lte' | 'contient' | 'existe'
  val: string | number | boolean
  badge?: BadgeCondition
}

export type SegmentDB = {
  id: string
  nom: string
  description: string | null
  couleur: string
  filtres: Condition[]
  created_at: string
}

export type CatalogOptions = {
  styles:      string[]
  typeBeat:    string[]
  ambiances:   string[]
  instruments: string[]
  licences:    string[]
}

// Données nécessaires pour évaluer les filtres
export type ContactFiltre = {
  statut: 'abonne' | 'ancien' | 'client' | 'lead'
  ltv: number
  nb_achats: number
  panier_moyen: number | null
  mensualites_payees: number
  dernier_achat_iso: string | null
  premierContactISO: string
  newsletter_consent: boolean
  langue: 'FR' | 'EN'
  pays: string | null
  instagram: string | null
  spotify: string | null
  youtube: string | null
  tiktok: string | null
  pref_style: string | null
  pref_type_beat: string | null
  pref_ambiance: string | null
  pref_instruments: string | null
  pref_licence: string | null
  tags: string[]
  source: string | null
  score_rf: 'Régulier' | 'Fidèle' | 'Occasionnel' | 'Dormant'
  score_chaleur: 'Chaud' | 'Tiède' | 'Froid'
  nb_favoris: number
  nb_free_downloads: number
}

// ── Scores ─────────────────────────────────────────────────────────────────────

export function computeScoreRF(
  nbAchats: number,
  dernierAchatIso: string | null,
): 'Régulier' | 'Fidèle' | 'Occasionnel' | 'Dormant' {
  const jours = dernierAchatIso
    ? Math.floor((Date.now() - new Date(dernierAchatIso).getTime()) / 86_400_000)
    : Infinity
  const frequent = nbAchats >= 3
  const recent   = jours <= 180
  if (frequent && recent)  return 'Régulier'
  if (frequent && !recent) return 'Fidèle'
  if (!frequent && recent) return 'Occasionnel'
  return 'Dormant'
}

export function computeScoreChaleur(
  source: string | null,
  nbFavoris: number,
  nbFreeDL: number,
  newsletterConsent: boolean,
): 'Chaud' | 'Tiède' | 'Froid' {
  let score = 0
  if (source === 'free_download') score += 40
  else if (source === 'newsletter') score += 20
  else if (source === 'visite')     score += 10
  score += nbFreeDL  * 15
  score += nbFavoris * 10
  if (newsletterConsent) score += 10
  return score > 70 ? 'Chaud' : score >= 35 ? 'Tiède' : 'Froid'
}

// ── Définition des champs disponibles dans le filter builder ───────────────────

export type TypeValeur = 'enum' | 'number' | 'boolean' | 'text'

export type ChampDef = {
  champ: string
  label: string
  type: TypeValeur
  options?: { val: string; label: string }[]
  catalogKey?: keyof CatalogOptions   // options dynamiques depuis le catalogue
  unite?: string
}

export const CHAMPS: ChampDef[] = [
  // Statut
  {
    champ: 'statut', label: 'Statut', type: 'enum',
    options: [
      { val: 'a_achete', label: 'Client' },
      { val: 'abonne',   label: 'Abonné actif' },
      { val: 'ancien',   label: 'Ancien abonné' },
      { val: 'client',   label: 'Achat direct (jamais abonné)' },
      { val: 'lead',     label: 'Lead' },
    ],
  },
  // Scores
  {
    champ: 'score_rf', label: 'Score client (RF)', type: 'enum',
    options: [
      { val: 'Régulier',    label: 'Régulier — fréquent + récent' },
      { val: 'Fidèle',      label: 'Fidèle — fréquent + dormant' },
      { val: 'Occasionnel', label: 'Occasionnel — peu fréquent + récent' },
      { val: 'Dormant',     label: 'Dormant — peu fréquent + inactif' },
    ],
  },
  {
    champ: 'score_chaleur', label: 'Score chaleur (lead)', type: 'enum',
    options: [
      { val: 'Chaud', label: 'Chaud' },
      { val: 'Tiède', label: 'Tiède' },
      { val: 'Froid', label: 'Froid' },
    ],
  },
  // Achats
  { champ: 'ltv',                  label: 'LTV',             type: 'number', unite: '€' },
  { champ: 'nb_achats',            label: 'Nb achats',       type: 'number' },
  { champ: 'panier_moyen',         label: 'Panier moyen',    type: 'number', unite: '€' },
  { champ: 'mensualites_payees',   label: 'Mois réglés',     type: 'number' },
  { champ: 'dernier_achat_jours',  label: 'Dernier achat',   type: 'number', unite: 'jours' },
  { champ: 'client_depuis_jours',  label: 'Client depuis',   type: 'number', unite: 'jours' },
  { champ: 'nb_favoris',           label: 'Nb favoris',      type: 'number' },
  { champ: 'nb_free_downloads',    label: 'Nb free DL',      type: 'number' },
  // Identité
  {
    champ: 'langue', label: 'Langue', type: 'enum',
    options: [
      { val: 'FR', label: 'Français' },
      { val: 'EN', label: 'Anglophone' },
    ],
  },
  { champ: 'pays', label: 'Pays', type: 'text' },
  {
    champ: 'newsletter', label: 'Newsletter', type: 'boolean',
    options: [
      { val: 'true',  label: 'Inscrit' },
      { val: 'false', label: 'Non inscrit' },
    ],
  },
  // Réseaux sociaux
  {
    champ: 'a_instagram', label: 'A un Instagram', type: 'boolean',
    options: [{ val: 'true', label: 'Oui' }, { val: 'false', label: 'Non' }],
  },
  {
    champ: 'a_spotify', label: 'A un Spotify', type: 'boolean',
    options: [{ val: 'true', label: 'Oui' }, { val: 'false', label: 'Non' }],
  },
  {
    champ: 'a_youtube', label: 'A un YouTube', type: 'boolean',
    options: [{ val: 'true', label: 'Oui' }, { val: 'false', label: 'Non' }],
  },
  {
    champ: 'a_tiktok', label: 'A un TikTok', type: 'boolean',
    options: [{ val: 'true', label: 'Oui' }, { val: 'false', label: 'Non' }],
  },
  // Préférences musicales (options dynamiques depuis catalogue)
  { champ: 'pref_style',       label: 'Style préféré',       type: 'text', catalogKey: 'styles'      },
  { champ: 'pref_type_beat',   label: 'Type beat préféré',   type: 'text', catalogKey: 'typeBeat'    },
  { champ: 'pref_ambiance',    label: 'Ambiance préférée',   type: 'text', catalogKey: 'ambiances'   },
  { champ: 'pref_instruments', label: 'Instrument préféré',  type: 'text', catalogKey: 'instruments' },
  { champ: 'pref_licence',     label: 'Licence préférée',    type: 'text', catalogKey: 'licences'    },
  // Tags & source
  { champ: 'tags', label: 'Tag', type: 'text' },
  {
    champ: 'source', label: 'Source d\'entrée', type: 'enum',
    options: [
      { val: 'free_download', label: 'Free download' },
      { val: 'newsletter',    label: 'Newsletter' },
      { val: 'visite',        label: 'Visite' },
      { val: 'manuel',        label: 'Ajout manuel' },
    ],
  },
]

export const OPS_PAR_TYPE: Record<TypeValeur, { val: Condition['op']; label: string }[]> = {
  enum:    [{ val: 'eq', label: 'est' }, { val: 'neq', label: 'n\'est pas' }],
  boolean: [{ val: 'eq', label: 'est' }, { val: 'neq', label: 'n\'est pas' }],
  number:  [
    { val: 'eq',  label: 'est égal à' },
    { val: 'gte', label: 'est supérieur ou égal à' },
    { val: 'lte', label: 'est inférieur ou égal à' },
    { val: 'neq', label: 'est différent de' },
  ],
  text: [
    { val: 'eq',       label: 'est exactement' },
    { val: 'contient', label: 'contient' },
    { val: 'neq',      label: 'n\'est pas' },
    { val: 'existe',   label: 'existe' },
  ],
}

// ── Évaluation ─────────────────────────────────────────────────────────────────

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

function getValeur(contact: ContactFiltre, champ: string): unknown {
  const joursDepuis = (iso: string | null) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : Infinity

  switch (champ) {
    case 'statut':               return contact.statut
    case 'score_rf':             return contact.score_rf
    case 'score_chaleur':        return contact.score_chaleur
    case 'ltv':                  return contact.ltv
    case 'nb_achats':            return contact.nb_achats
    case 'panier_moyen':         return contact.panier_moyen ?? 0
    case 'mensualites_payees':   return contact.mensualites_payees
    case 'dernier_achat_jours':  return joursDepuis(contact.dernier_achat_iso)
    case 'client_depuis_jours':  return joursDepuis(contact.premierContactISO)
    case 'nb_favoris':           return contact.nb_favoris
    case 'nb_free_downloads':    return contact.nb_free_downloads
    case 'newsletter':           return contact.newsletter_consent
    case 'langue':
      return contact.langue ?? (PAYS_FR.has((contact.pays ?? '').toUpperCase()) ? 'FR' : 'EN')
    case 'pays':                 return contact.pays ?? ''
    case 'a_instagram':          return !!contact.instagram
    case 'a_spotify':            return !!contact.spotify
    case 'a_youtube':            return !!contact.youtube
    case 'a_tiktok':             return !!contact.tiktok
    case 'pref_style':           return contact.pref_style ?? ''
    case 'pref_type_beat':       return contact.pref_type_beat ?? ''
    case 'pref_ambiance':        return contact.pref_ambiance ?? ''
    case 'pref_instruments':     return contact.pref_instruments ?? ''
    case 'pref_licence':         return contact.pref_licence ?? ''
    case 'tags':                 return contact.tags
    case 'source':               return contact.source ?? ''
    default:                     return null
  }
}

function evalCondition(contact: ContactFiltre, cond: Condition): boolean {
  // Cas spécial : 'a_achete' = tous ceux qui ont déjà payé (client + abonné + ancien)
  if (cond.champ === 'statut' && String(cond.val) === 'a_achete') {
    const estAchete = ['abonne', 'ancien', 'client'].includes(contact.statut)
    let result = cond.op === 'neq' ? !estAchete : estAchete
    if (result && cond.badge && cond.badge.vals.length > 0) {
      const badgeVal = cond.badge.champ === 'score_rf' ? contact.score_rf : contact.score_chaleur
      if (cond.badge.op === 'any')      result = cond.badge.vals.includes(badgeVal)
      else if (cond.badge.op === 'eq')  result = badgeVal === cond.badge.vals[0]
      else if (cond.badge.op === 'neq') result = badgeVal !== cond.badge.vals[0]
    }
    return result
  }

  const val = getValeur(contact, cond.champ)

  let result: boolean

  if (cond.op === 'existe') {
    result = val !== null && val !== '' && val !== Infinity
  } else if (cond.champ === 'tags') {
    const tags = val as string[]
    if (cond.op === 'contient') result = tags.includes(String(cond.val))
    else if (cond.op === 'eq')  result = tags.includes(String(cond.val))
    else if (cond.op === 'neq') result = !tags.includes(String(cond.val))
    else result = false
  } else if (typeof val === 'boolean') {
    const cmpBool = String(cond.val) === 'true'
    if (cond.op === 'eq')       result = val === cmpBool
    else if (cond.op === 'neq') result = val !== cmpBool
    else result = false
  } else if (cond.op === 'gte') {
    result = Number(val) >= Number(cond.val)
  } else if (cond.op === 'lte') {
    result = Number(val) <= Number(cond.val)
  } else {
    const cmpStr  = String(val).toLowerCase()
    const condStr = String(cond.val).toLowerCase()
    if (cond.op === 'contient') result = cmpStr.includes(condStr)
    else if (cond.op === 'eq')  result = cmpStr === condStr
    else if (cond.op === 'neq') result = cmpStr !== condStr
    else result = false
  }

  // Badge intégré (uniquement pour statut) — évalué en AND avec le statut
  if (result && cond.badge && cond.badge.vals.length > 0) {
    const badgeVal = cond.badge.champ === 'score_rf' ? contact.score_rf : contact.score_chaleur
    if (cond.badge.op === 'any')      result = cond.badge.vals.includes(badgeVal)
    else if (cond.badge.op === 'eq')  result = badgeVal === cond.badge.vals[0]
    else if (cond.badge.op === 'neq') result = badgeVal !== cond.badge.vals[0]
  }

  return result
}

export function evaluerFiltres(contact: ContactFiltre, filtres: Condition[]): boolean {
  if (filtres.length === 0) return true
  let result = evalCondition(contact, filtres[0])
  for (let i = 1; i < filtres.length; i++) {
    const cond = filtres[i]
    const v = evalCondition(contact, cond)
    result = cond.lien === 'OU' ? result || v : result && v
  }
  return result
}

// ── Couleurs ───────────────────────────────────────────────────────────────────

export const COULEURS: { val: string; cls: string; dot: string }[] = [
  { val: 'indigo', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20', dot: 'bg-indigo-400' },
  { val: 'green',  cls: 'bg-green-500/15  text-green-400  border-green-500/20',  dot: 'bg-green-400'  },
  { val: 'blue',   cls: 'bg-blue-500/15   text-blue-400   border-blue-500/20',   dot: 'bg-blue-400'   },
  { val: 'orange', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/20', dot: 'bg-orange-400' },
  { val: 'yellow', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', dot: 'bg-yellow-400' },
  { val: 'red',    cls: 'bg-red-500/15    text-red-400    border-red-500/20',    dot: 'bg-red-400'    },
  { val: 'gray',   cls: 'bg-gray-500/15   text-gray-400   border-gray-500/20',   dot: 'bg-gray-400'   },
]

export function couleurCls(couleur: string): string {
  return COULEURS.find(c => c.val === couleur)?.cls ?? COULEURS[0].cls
}
