// Apple Pay / Google Pay : un site doit être déclaré chez Stripe sur le compte
// qui porte le paiement (compte du vendeur, ou Sonoo pour un panier collab).
// Partagé par app/api/stripe/contexte-paiement et l'activation d'un domaine
// personnalisé (rang 9c, lot 3).
import { stripe } from '@/lib/stripe'

// Évite un aller-retour Stripe à chaque checkout sur une même instance
// serveur. La vérification reste idempotente entre instances/serverless.
const domainesAssures = new Set<string>()

export async function assurerDomainePaiement(hostname: string, stripeAccountId?: string): Promise<void> {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return

  const cacheKey = `${stripeAccountId ?? 'plateforme'}:${hostname}`
  if (domainesAssures.has(cacheKey)) return

  const options = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  const domaines = await stripe.paymentMethodDomains.list(
    { domain_name: hostname, limit: 1 },
    options,
  )

  let domaine = domaines.data[0]
  if (!domaine) {
    domaine = await stripe.paymentMethodDomains.create(
      { domain_name: hostname, enabled: true },
      options,
    )
  } else if (!domaine.enabled) {
    domaine = await stripe.paymentMethodDomains.update(
      domaine.id,
      { enabled: true },
      options,
    )
  }

  // Un domaine déjà créé avant l'activation complète d'un wallet peut rester
  // inactif. Stripe recommande alors de relancer sa validation.
  if (domaine.google_pay.status !== 'active') {
    domaine = await stripe.paymentMethodDomains.validate(domaine.id, {}, options)
  }

  if (domaine.google_pay.status === 'active') domainesAssures.add(cacheKey)
}

