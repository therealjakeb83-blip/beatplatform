// Identité de la plateforme — le SEUL endroit où changer le nom, l'adresse
// du site ou les adresses email. Ne jamais réécrire ces valeurs en dur ailleurs.
export const NOM_PLATEFORME = 'Sonoo'

export const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sonoo.app'

// Envois automatiques = sous-domaine mail.sonoo.app (vérifié chez Resend le
// 2026-10-16), pour que la réputation de sonoo.app reste à part. Chaque boutique
// envoie depuis sa propre adresse <slug>@. Le contact reste sur l'ancien domaine
// tant que la réception de contact@sonoo.app n'est pas branchée.
export const DOMAINE_ENVOI = 'mail.sonoo.app'
export const EMAIL_EXPEDITEUR_PLATEFORME = `noreply@${DOMAINE_ENVOI}`
export const EMAIL_CONTACT = 'contact@jakebmusic.com'

export function expediteurBoutique(boutique: { nom_artiste: string; slug: string | null }): string {
  const local = (boutique.slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'boutique'
  return `${boutique.nom_artiste} <${local}@${DOMAINE_ENVOI}>`
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
