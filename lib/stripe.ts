import Stripe from 'stripe'

// Instanciation paresseuse (comme lib/resend.ts) : un `new Stripe(...)` au
// chargement du module casse le build Vercel dès que Next.js évalue ce
// fichier pendant la collecte de page data, si la clé n'est pas encore
// disponible à ce moment précis ("Neither apiKey nor config.authenticator
// provided", constaté le 2026-07-17). Le Proxy préserve l'usage existant
// (stripe.xxx.yyy()) dans tous les fichiers qui l'importent, sans les
// toucher — seul le premier accès réel, à l'exécution d'une requête,
// déclenche l'instanciation.
let _stripe: Stripe | null = null

function getStripeInstance(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripeInstance(), prop, receiver)
  },
})
