import { loadStripe, type Stripe } from '@stripe/stripe-js'

// developerTools.assistant.enabled: false -- masque la bulle flottante
// "Stripe Développeurs" que Stripe.js affiche par défaut en mode test
// (gêne l'expérience du site, sans rapport avec le fonctionnement réel des
// paiements). Sans effet en mode live, où elle ne s'affiche jamais.
const OPTIONS = { developerTools: { assistant: { enabled: false } } }

// Client Stripe.js plateforme — utilisé uniquement pour le mode "held"
// (ventes avec split collab, fonds retenus sur la plateforme, voir
// lib/webhook-paiement.ts).
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, OPTIONS)

// Ventes simples (Direct Charge, toutes les boutiques depuis la Phase 2) :
// le PaymentIntent appartient au compte connecté lui-même — Stripe.js doit
// être chargé avec le contexte `stripeAccount` de ce compte. Un seul client
// par compte, mémoïsé (pas un nouveau `loadStripe` à chaque rendu).
const clientsParCompte = new Map<string, Promise<Stripe | null>>()

export function chargerStripePourCompte(stripeAccountId: string): Promise<Stripe | null> {
  let promesse = clientsParCompte.get(stripeAccountId)
  if (!promesse) {
    promesse = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
      ...OPTIONS,
      stripeAccount: stripeAccountId,
    })
    clientsParCompte.set(stripeAccountId, promesse)
  }
  return promesse
}
