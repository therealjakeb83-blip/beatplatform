import crypto from 'crypto'

// Rang 9f, Lot 1 (décision 4 bis) : lien signé et permanent de l'email de
// confirmation de l'ACHETEUR (jamais dans l'email « nouvelle vente » du
// vendeur). Module sans dépendance serveur : importable par les emails.

// Accès qui comptent comme preuve dans une réponse de litige (décision 4 bis).
export const ORIGINES_PREUVE = ['appareil_paiement', 'compte_acheteur', 'lien_email']

function signature(texte: string): string {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s) throw new Error("UNSUBSCRIBE_SECRET manquant dans les variables d'environnement")
  return crypto.createHmac('sha256', s).update(texte).digest('base64url')
}

// Jeton permanent du lien de l'email de confirmation (acheteur seulement).
export function jetonLienEmail(commandeId: string): string {
  return signature(`dl-lien:${commandeId}`)
}

export function jetonLienEmailValide(commandeId: string, jeton: string | null): boolean {
  if (!jeton) return false
  const attendu = jetonLienEmail(commandeId)
  return jeton.length === attendu.length && crypto.timingSafeEqual(Buffer.from(jeton), Buffer.from(attendu))
}

// Adresse du lien signé à mettre dans l'email de confirmation de l'acheteur.
export function cheminLienEmail(commandeId: string): string {
  return `/telechargement/${commandeId}/acces?t=${jetonLienEmail(commandeId)}`
}


// Adresse Sonoo permanente d'un fichier de commande (voir
// app/telechargement/[commandeId]/fichier/[ref]/route.ts).
// ref = facture | facture-{tranche} | avoir-{avoir} | contrat-{ligne} | mp3-{ligne} | wav-{ligne} | stems-{ligne}
export function cheminFichierCommande(commandeId: string, ref: string): string {
  return `/telechargement/${commandeId}/fichier/${ref}`
}

// Journal des emails : le lien signé devient un lien simple vers la page de
// téléchargement (qui demandera l'email). Un « Renvoyer » depuis le journal
// garde donc un lien utilisable, sans jamais exposer le jeton au vendeur.
export function masquerJetonsAcces(contenu: string): string {
  return contenu.replace(/\/telechargement\/([0-9a-f-]{36})\/acces\?t=[A-Za-z0-9_-]+(?:&(?:amp;)?suite=[A-Za-z0-9-]+)?/g, '/telechargement/$1')
}
