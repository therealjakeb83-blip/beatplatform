import { loadStripe } from '@stripe/stripe-js'

// developerTools.assistant.enabled: false -- masque la bulle flottante
// "Stripe Développeurs" que Stripe.js affiche par défaut en mode test
// (gêne l'expérience du site, sans rapport avec le fonctionnement réel des
// paiements). Sans effet en mode live, où elle ne s'affiche jamais.
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
  developerTools: { assistant: { enabled: false } },
})
