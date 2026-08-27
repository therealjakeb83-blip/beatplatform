// Moyens de paiement — Niveau A (décision commerciale du beatmaker) vs
// Niveau B (implémentation technique Stripe, jamais exposée comme un choix).
// Décision du Grill Me (2026-08-08) : carte/PayPal/virement listés comme
// catégories à substance commerciale, réglables par le beatmaker — Apple
// Pay/Google Pay/SCA restent de l'infrastructure gérée par My Producer.
//
// "Virement" retiré le 2026-08-27 (Jake ne se souvenait pas d'avoir vraiment
// voulu cette option — pas de cas d'usage identifié) : possibilité gardée
// pour plus tard si un vrai besoin apparaît, pas réintroduite pour l'instant.
// Seule 'carte' (baseline) et 'paypal' restent des choix actifs.
//
// Cette couche de mapping existe pour ne jamais injecter le tableau UI
// directement dans les paramètres Stripe (cf. plan Phase 2, correction du
// Grill Me) : le Niveau A ne change qu'ici, jamais dans les routes de
// checkout elles-mêmes.

export type MoyenPaiementNiveauA = 'carte' | 'paypal'

export const MOYENS_PAIEMENT_TOGGLABLES: MoyenPaiementNiveauA[] = ['paypal']

// Carte toujours active — baseline, jamais désactivable (pas de config
// checkout vide possible).
export const MOYEN_PAIEMENT_BASELINE: MoyenPaiementNiveauA = 'carte'

export function normaliserMoyensPaiement(input: unknown): MoyenPaiementNiveauA[] {
  const valides = new Set<MoyenPaiementNiveauA>(['carte', 'paypal'])
  const choisis = Array.isArray(input) ? input.filter((m): m is MoyenPaiementNiveauA => valides.has(m)) : []
  return [...new Set([MOYEN_PAIEMENT_BASELINE, ...choisis])]
}

// Niveau B — Checkout Session classique (redirection). PayPal n'est PAS
// utilisable ici quel que soit le choix du beatmaker : Stripe refuse
// catégoriquement 'paypal' dans payment_method_types dès qu'une Checkout
// Session est créée pour un compte connecté (Direct Charge OU on_behalf_of)
// — vérifié directement via l'API le 2026-08-27 ("The Paypal payment method
// does not support Connect charges created on behalf of connected accounts,
// including Direct Charges and charges created with on_behalf_of"). PayPal
// reste disponible uniquement via le paiement express (voir
// paypalAutoriseEnExpress ci-dessous), qui passe par un mécanisme Stripe
// différent (PaymentIntent + ExpressCheckoutElement) où ça fonctionne.
export function mapperVersPaymentMethodTypes(moyens: MoyenPaiementNiveauA[]): ('card')[] {
  void moyens
  return ['card']
}

// Niveau B — paiement express (ExpressCheckoutElement). Apple Pay/Google Pay
// ne dépendent jamais de ce réglage (infrastructure, disponibilité device
// uniquement) — seul PayPal est conditionné par le choix commercial du
// beatmaker, en plus de sa disponibilité réelle détectée par Stripe.
export function paypalAutoriseEnExpress(moyens: MoyenPaiementNiveauA[]): boolean {
  return moyens.includes('paypal')
}
