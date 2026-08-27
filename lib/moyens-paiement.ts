// Moyens de paiement — Niveau A (décision commerciale du beatmaker) vs
// Niveau B (implémentation technique Stripe, jamais exposée comme un choix).
// Décision du Grill Me (2026-08-08) : carte/PayPal/virement sont des
// catégories à substance commerciale, réglables par le beatmaker — Apple
// Pay/Google Pay/SCA restent de l'infrastructure gérée par My Producer.
//
// Cette couche de mapping existe pour ne jamais injecter le tableau UI
// directement dans les paramètres Stripe (cf. plan Phase 2, correction du
// Grill Me) : le Niveau A ne change qu'ici, jamais dans les routes de
// checkout elles-mêmes.

export type MoyenPaiementNiveauA = 'carte' | 'paypal' | 'virement'

export const MOYENS_PAIEMENT_TOGGLABLES: MoyenPaiementNiveauA[] = ['paypal', 'virement']

// Carte toujours active — baseline, jamais désactivable (pas de config
// checkout vide possible). Les deux autres sont de vrais choix beatmaker.
export const MOYEN_PAIEMENT_BASELINE: MoyenPaiementNiveauA = 'carte'

export function normaliserMoyensPaiement(input: unknown): MoyenPaiementNiveauA[] {
  const valides = new Set<MoyenPaiementNiveauA>(['carte', 'paypal', 'virement'])
  const choisis = Array.isArray(input) ? input.filter((m): m is MoyenPaiementNiveauA => valides.has(m)) : []
  return [...new Set([MOYEN_PAIEMENT_BASELINE, ...choisis])]
}

// Niveau B — Checkout Session classique (redirection). 'virement' se
// traduit par le SEPA Direct Debit Stripe (`sepa_debit`), l'équivalent le
// plus proche disponible sur Checkout pour un paiement bancaire européen —
// pas un vrai virement libre, à valider techniquement avant activation réelle
// (cf. contraintes de rollout Phase 2 : Niveau B reste géré par My Producer).
export function mapperVersPaymentMethodTypes(moyens: MoyenPaiementNiveauA[]): ('card' | 'paypal' | 'sepa_debit')[] {
  const types: ('card' | 'paypal' | 'sepa_debit')[] = ['card']
  if (moyens.includes('paypal')) types.push('paypal')
  if (moyens.includes('virement')) types.push('sepa_debit')
  return types
}

// Niveau B — paiement express (ExpressCheckoutElement). Apple Pay/Google Pay
// ne dépendent jamais de ce réglage (infrastructure, disponibilité device
// uniquement) — seul PayPal est conditionné par le choix commercial du
// beatmaker, en plus de sa disponibilité réelle détectée par Stripe.
export function paypalAutoriseEnExpress(moyens: MoyenPaiementNiveauA[]): boolean {
  return moyens.includes('paypal')
}
