import { loadStripe, type Stripe } from '@stripe/stripe-js'

// developerTools.assistant.enabled: false -- masque la bulle flottante
// "Stripe Développeurs" que Stripe.js affiche par défaut en mode test
// (gêne l'expérience du site, sans rapport avec le fonctionnement réel des
// paiements). Sans effet en mode live, où elle ne s'affiche jamais.
const OPTIONS = { developerTools: { assistant: { enabled: false } } }

// Ancien flux (destination charge) : un seul client Stripe.js pour toute
// l'app, `on_behalf_of` posé comme option Elements (CartExpressPay.tsx,
// LicenceExpressPay.tsx). Reste utilisé tant qu'une boutique n'a pas
// `direct_charge_actif`.
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, OPTIONS)

// Nouveau flux (Direct Charge, Phase 2) : en Direct Charge, le PaymentIntent
// appartient au compte connecté lui-même — Stripe.js doit être chargé avec
// le contexte `stripeAccount` de ce compte, pas avec `on_behalf_of` en
// option Elements (qui n'a de sens que pour une destination charge). Un seul
// client par compte, mémoïsé (pas un nouveau `loadStripe` à chaque rendu).
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
