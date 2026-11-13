// Règles du slug d'une boutique (rang 9c bis) : il devient l'adresse slug.sonoo.app,
// donc un nom valide sur internet, et jamais un mot qui ferait croire au visiteur
// qu'il est chez Sonoo (décision 2A de Jake, 2026-11-12). Règles pures, partagées
// par proxy.ts, les routes et les formulaires.

export const SLUG_LONGUEUR_MIN = 3
export const SLUG_LONGUEUR_MAX = 50

const MOTS_RESERVES = new Set([
  // Technique : adresses déjà utilisées par le site ou les emails, ou classiques d'un hébergeur.
  'www', 'www1', 'www2', 'mail', 'email', 'emails', 'mails', 'webmail', 'smtp', 'imap', 'pop', 'pop3', 'mx',
  'send', 'bounce', 'bounces', 'ftp', 'sftp', 'ssh', 'ns', 'ns1', 'ns2', 'ns3', 'dns', 'api', 'apis', 'app',
  'apps', 'cdn', 'static', 'assets', 'media', 'img', 'image', 'images', 'files', 'fichiers', 'upload', 'uploads',
  'storage', 'stockage', 'download', 'downloads', 'status', 'statut', 'dev', 'staging', 'preview', 'beta',
  'demo', 'test', 'tests', 'docs', 'doc', 'documentation', 'blog', 'news', 'actualites', 'web', 'site', 'local',
  'localhost', 'proxy', 'server', 'serveur', 'host', 'hosting', 'cloud', 'vercel', 'autoconfig', 'autodiscover',
  // Pages du site.
  'dashboard', 'tableau-de-bord', 'connexion', 'deconnexion', 'inscription', 'paiement', 'paiements',
  'telechargement', 'telechargements', 'artiste', 'artistes', 'auth', 'maintenance', 'mon-compte',
  'mot-de-passe-oublie', 'nouveau-mot-de-passe', 'confirmation-compte', 'verification-en-cours', 'sitemap',
  'apercu-vitrine', 'robots', 'favicon', 'abonnement', 'abonnements', 'plans', 'tarifs', 'pricing', 'accueil', 'home',
  // Ce qui imiterait Sonoo, son support ou un service de confiance.
  'admin', 'admins', 'administrateur', 'administration', 'administrator', 'root', 'system', 'systeme',
  'support', 'aide', 'help', 'helpdesk', 'assistance', 'contact', 'contacts', 'sav', 'service-client',
  'customer-service', 'officiel', 'official', 'equipe', 'team', 'staff', 'moderation', 'moderateur', 'moderator',
  'securite', 'security', 'secure', 'login', 'logout', 'signin', 'signup', 'register', 'compte', 'comptes',
  'account', 'accounts', 'mon-espace', 'espace-client', 'profil', 'profile', 'billing', 'facturation',
  'factures', 'invoice', 'invoices', 'payment', 'payments', 'pay', 'checkout', 'wallet', 'banque', 'bank',
  'stripe', 'paypal', 'apple', 'google', 'verification', 'verify', 'validation', 'oauth', 'sso', 'password',
  'motdepasse', 'mot-de-passe', 'legal', 'juridique', 'cgu', 'cgv', 'privacy', 'confidentialite', 'abuse',
  'postmaster', 'hostmaster', 'webmaster', 'noreply', 'no-reply', 'info', 'infos', 'hello', 'bonjour',
  'shop', 'store', 'boutique', 'boutiques', 'market', 'marketplace', 'beatstars', 'airbit', 'traktrain',
])

export type RefusSlug = 'court' | 'long' | 'format' | 'reserve'

// Mot interdit, ou contenant « sonoo » (même écrit s0noo ou so-noo).
export function estSlugReserve(slug: string): boolean {
  const s = slug.toLowerCase()
  return MOTS_RESERVES.has(s) || s.replace(/-/g, '').replace(/0/g, 'o').includes('sonoo')
}

// Lettres et chiffres séparés par des tirets simples : jamais de tiret au début,
// à la fin ou en double (adresse internet valide).
const FORMAT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Adresse slug.sonoo.app utilisable : un ancien slug mal formé (accent, tiret en tête,
// plus de 63 caractères) ou réservé reste sur sonoo.app/slug plutôt que vers une adresse morte.
export function sousDomainePossible(slug: string): boolean {
  return slug.length <= 63 && FORMAT_SLUG.test(slug) && !estSlugReserve(slug)
}

export function refusSlug(slug: string): RefusSlug | null {
  if (slug.length < SLUG_LONGUEUR_MIN) return 'court'
  if (slug.length > SLUG_LONGUEUR_MAX) return 'long'
  if (!FORMAT_SLUG.test(slug)) return 'format'
  if (estSlugReserve(slug)) return 'reserve'
  return null
}

export function messageRefusSlug(refus: RefusSlug): string {
  switch (refus) {
    case 'court': return `L'adresse doit faire au moins ${SLUG_LONGUEUR_MIN} caractères.`
    case 'long': return `L'adresse ne peut pas dépasser ${SLUG_LONGUEUR_MAX} caractères.`
    case 'format': return 'Utilise seulement des lettres, des chiffres et des tirets simples.'
    case 'reserve': return 'Cette adresse est réservée, choisis-en une autre.'
  }
}

// Saisie libre → slug : minuscules, accents retirés, tout le reste en tirets simples.
export function nettoyerSlug(brut: string): string {
  return brut
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_LONGUEUR_MAX)
    .replace(/-$/, '')
}

// Slug automatique donné à l'inscription (remplacé une fois par le choix du
// beatmaker) : nom nettoyé + 8 premiers caractères de l'identifiant du compte,
// donc unique et toujours une adresse valide, 50 caractères au plus.
export function slugAutomatique(nomArtiste: string, beatmakerId: string): string {
  const suffixe = beatmakerId.replace(/-/g, '').slice(0, 8).toLowerCase()
  let base = nettoyerSlug(nomArtiste).slice(0, SLUG_LONGUEUR_MAX - suffixe.length - 1).replace(/-$/, '')
  // Un nom contenant « sonoo » ne passe pas dans l'adresse.
  if (!base || estSlugReserve(`${base}-${suffixe}`)) base = 'boutique'
  return `${base}-${suffixe}`
}
