// Identité de la plateforme — le SEUL endroit où changer le nom, l'adresse
// du site ou les adresses email. Ne jamais réécrire ces valeurs en dur ailleurs.
export const NOM_PLATEFORME = 'Sonoo'

export const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sonoo.app'

// Adresses encore sur l'ancien domaine tant que sonoo.app n'est pas vérifié
// chez Resend et que la réception de contact@ n'est pas branchée (lot 2).
export const EMAIL_EXPEDITEUR_PLATEFORME = 'noreply@jakebmusic.com'
export const EMAIL_EXPEDITEUR_BOUTIQUES = 'campagnes@jakebmusic.com'
export const EMAIL_CONTACT = 'contact@jakebmusic.com'

export function expediteurBoutique(nomArtiste: string): string {
  return `${nomArtiste} <${EMAIL_EXPEDITEUR_BOUTIQUES}>`
}

// Étiquette posée dans les metadata Stripe sur ce que la plateforme lance
// elle-même (remboursements, réponses aux litiges, configuration du portail).
// Neutre exprès pour ne pas dépendre du nom ; les objets Stripe créés avant le
// passage à Sonoo portent encore 'my_producer' et restent reconnus.
export const ETIQUETTE_STRIPE = 'plateforme'
const ETIQUETTES_STRIPE_ACCEPTEES = new Set([ETIQUETTE_STRIPE, 'my_producer'])

export function estEtiquettePlateforme(valeur: string | null | undefined): boolean {
  return !!valeur && ETIQUETTES_STRIPE_ACCEPTEES.has(valeur)
}
