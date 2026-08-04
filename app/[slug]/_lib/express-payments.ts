// Priorité des moyens de paiement express affichés dans la popup licence.
// Règle (spec produit) :
//   1. Apple Pay dispo -> Apple Pay (+ PayPal si dispo). Jamais Google Pay.
//   2. Sinon si Google Pay dispo -> Google Pay (+ PayPal si dispo).
//   3. Sinon -> PayPal seul si dispo.
//   4. Sinon -> aucun moyen express (zone masquée).
// La disponibilité vient uniquement de Stripe (ExpressCheckoutElement,
// événement onReady) — jamais d'une détection iOS/Android/user-agent.

export type ExpressAvailability = {
  applePayAvailable: boolean
  googlePayAvailable: boolean
  paypalAvailable: boolean
}

export type ExpressMethod = 'apple_pay' | 'google_pay' | 'paypal'

export function selectExpressPaymentMethods(a: ExpressAvailability): ExpressMethod[] {
  const wallet: ExpressMethod | null = a.applePayAvailable
    ? 'apple_pay'
    : a.googlePayAvailable
      ? 'google_pay'
      : null

  return [wallet, a.paypalAvailable ? 'paypal' : null].filter(
    (m): m is ExpressMethod => m !== null
  )
}
