// Priorité des moyens de paiement express (popup panier, page de paiement
// custom) — règle produit :
//   - iOS/iPadOS -> Apple Pay uniquement, jamais Google Pay.
//   - Tout le reste -> Google Pay uniquement, jamais Apple Pay.
//   - Link -> toujours demandé en 'auto' dans les deux cas (n'accepte pas
//     'always' côté Stripe), sur la même ligne que le wallet.
//   - PayPal -> jamais proposé ici, incompatible Direct Charge (voir memory
//     project_phase2_direct_charge_implementation).
// La cible est fixée par appareil AVANT le montage de Stripe Elements —
// jamais par la disponibilité brute annoncée par Stripe (`availablePaymentMethods`),
// qui peut annoncer Apple ET Google Pay en même temps sur certains appareils
// (ex. Chrome desktop avec Apple Pay actif) et casserait la règle "jamais les
// deux ensemble". Un remount déclenché après lecture de cette disponibilité a
// déjà désactivé Google Pay par erreur sur Windows — ne jamais le réintroduire.

export function appareilEstIOS(): boolean {
  if (typeof navigator === 'undefined') return false

  // Sur iPadOS, Safari peut exposer un user-agent de Mac. Le tactile permet
  // de le distinguer d'un vrai Mac, sur lequel Google Pay doit rester
  // prioritaire conformément à la règle produit.
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export type MethodesExpressAppareil = {
  applePay: 'always' | 'never'
  googlePay: 'always' | 'never'
  paypal: 'never'
  link: 'auto'
  amazonPay: 'never'
  klarna: 'never'
}

export function methodesExpressPourAppareil(estIOS: boolean): MethodesExpressAppareil {
  return {
    applePay: estIOS ? 'always' : 'never',
    googlePay: estIOS ? 'never' : 'always',
    paypal: 'never',
    link: 'auto',
    amazonPay: 'never',
    klarna: 'never',
  }
}
