import type { Devise, OrdreDate } from './valeurs'

// Réponses du beatmaker à l'assistant (une par colonne + questions de suite).
// Mémorisées par jeu exact de colonnes (formats_import_externes) et renvoyées
// au serveur à l'aperçu et à l'import : le serveur relit le fichier et refait
// tout le calcul avec elles.

export const ROLES = [
  'email', 'date', 'numero', 'nom_complet', 'prenom', 'nom', 'titre', 'licence',
  'montant_commande', 'montant_ligne', 'quantite', 'remise', 'statut', 'devise', 'ignorer',
] as const
export type Role = (typeof ROLES)[number]

export const LIBELLES_ROLES: Record<Role, string> = {
  email: 'Email de l’acheteur',
  date: 'Date de la vente',
  numero: 'N° de commande',
  nom_complet: 'Nom complet de l’acheteur',
  prenom: 'Prénom de l’acheteur',
  nom: 'Nom de famille de l’acheteur',
  titre: 'Titre du beat / produit',
  licence: 'Licence',
  montant_commande: 'Montant payé pour toute la commande',
  montant_ligne: 'Prix de cet article (une ligne = un article)',
  quantite: 'Quantité',
  remise: 'Remise (montant)',
  statut: 'Statut de la commande',
  devise: 'Devise',
  ignorer: 'Ignorer cette colonne',
}

export const AIDES_ROLES: Partial<Record<Role, string>> = {
  montant_commande: 'Ce que le client a payé au total (TVA comprise si elle est incluse). Si la commande a plusieurs lignes, ce montant est répété sur chacune.',
  montant_ligne: 'Le prix d’un seul article. Sert à répartir le total entre les beats d’une commande.',
  numero: 'Les lignes qui ont le même numéro forment une seule commande.',
  statut: 'Tu choisiras ensuite quelles valeurs veulent dire « commande réglée ».',
}

// Séparateurs d'articles dans une même case (plusieurs beats achetés)
export const SEPARATEURS_ARTICLES = ['virgule_quantite', 'retour_ligne', 'point_virgule', 'barre', 'plus', 'slash', 'virgule'] as const
export type SeparateurArticles = (typeof SEPARATEURS_ARTICLES)[number]

export const LIBELLES_SEPARATEURS: Record<SeparateurArticles, string> = {
  virgule_quantite: 'une virgule suivie d’une quantité (« , 1× »)',
  retour_ligne: 'un retour à la ligne',
  point_virgule: 'un point-virgule « ; »',
  barre: 'une barre « | »',
  plus: 'un « + »',
  slash: 'une barre oblique « / »',
  virgule: 'une virgule « , »',
}

// Licence collée au titre : « Titre - X », « Titre | X », « Titre (X) », « [X] Titre »
export const FORMES_LICENCE = ['tiret', 'barre', 'parentheses', 'crochets'] as const
export type FormeLicence = (typeof FORMES_LICENCE)[number]

export type ChoixLicence =
  | { choix: 'licence'; licence_id: string }
  | { choix: 'sans_equivalent' }
  | { choix: 'pas_licence' }

export type Association = {
  version: 1
  colonnes: Role[]
  ordreDate: OrdreDate | null
  // valeurs de la colonne statut qui veulent dire « réglée » (null = pas de colonne statut)
  statutsRegles: string[] | null
  separateurArticles: SeparateurArticles | null
  formeLicence: FormeLicence | null
  // clé = licence normalisée (cleLicence)
  licences: Record<string, ChoixLicence>
  devise: Devise
  plateforme: string
}

export function cleLicence(valeur: string): string {
  return valeur.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function cleStatut(valeur: string): string {
  return valeur.trim().toLowerCase()
}

export class ErreurAssociation extends Error {}

const PLATEFORMES_RESERVEES = new Set(['beatstars', 'my producer', 'myproducer'])

// Contrôle serveur : rien n'est repris du navigateur sans vérification
export function verifierAssociation(brut: unknown, nbColonnes: number): Association {
  const a = brut as Partial<Association> | null
  if (!a || a.version !== 1 || !Array.isArray(a.colonnes)) throw new ErreurAssociation('Réponses de l’assistant illisibles : recommence l’association des colonnes.')
  if (a.colonnes.length !== nbColonnes) throw new ErreurAssociation('Le fichier ne correspond plus aux réponses de l’assistant : recommence l’association des colonnes.')
  for (const r of a.colonnes) if (!ROLES.includes(r)) throw new ErreurAssociation('Réponses de l’assistant illisibles.')
  for (const r of ROLES) {
    if (r !== 'ignorer' && a.colonnes.filter(c => c === r).length > 1) throw new ErreurAssociation(`« ${LIBELLES_ROLES[r]} » est choisi pour plusieurs colonnes : une seule colonne par information.`)
  }
  if (!a.colonnes.includes('email')) throw new ErreurAssociation('Il faut une colonne avec l’email de l’acheteur : c’est la seule information obligatoire.')
  if (a.devise !== 'EUR' && a.devise !== 'USD') throw new ErreurAssociation('Seuls les fichiers en euros (€) ou en dollars ($) sont acceptés pour l’instant.')
  const plateforme = String(a.plateforme ?? '').trim().replace(/\s+/g, ' ')
  if (!plateforme || plateforme.length > 40) throw new ErreurAssociation('Indique le nom de la plateforme (40 caractères maximum).')
  if (PLATEFORMES_RESERVEES.has(plateforme.toLowerCase())) throw new ErreurAssociation(`« ${plateforme} » est réservé : les exports BeatStars sont reconnus automatiquement. Choisis un autre nom.`)
  const statuts = a.colonnes.includes('statut') ? a.statutsRegles : null
  if (a.colonnes.includes('statut') && (!Array.isArray(statuts) || statuts.length === 0)) throw new ErreurAssociation('Indique quelles valeurs du statut veulent dire « commande réglée ».')
  const licences: Record<string, ChoixLicence> = {}
  for (const [cle, c] of Object.entries(a.licences ?? {})) {
    if (c?.choix === 'licence' && typeof c.licence_id === 'string') licences[cle] = { choix: 'licence', licence_id: c.licence_id }
    else if (c?.choix === 'sans_equivalent' || c?.choix === 'pas_licence') licences[cle] = { choix: c.choix }
  }
  return {
    version: 1,
    colonnes: a.colonnes,
    ordreDate: a.ordreDate === 'jm' || a.ordreDate === 'mj' ? a.ordreDate : null,
    statutsRegles: statuts ? statuts.map(String).map(cleStatut) : null,
    separateurArticles: a.separateurArticles && SEPARATEURS_ARTICLES.includes(a.separateurArticles) ? a.separateurArticles : null,
    formeLicence: a.formeLicence && FORMES_LICENCE.includes(a.formeLicence) ? a.formeLicence : null,
    licences,
    devise: a.devise,
    plateforme,
  }
}
