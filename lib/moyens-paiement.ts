// Moyens de paiement — Niveau A (décision commerciale du beatmaker) vs
// Niveau B (implémentation technique Stripe, jamais exposée comme un choix).
// Décision du Grill Me (2026-08-08) : carte/PayPal/virement listés initialement
// comme catégories à substance commerciale, réglables par le beatmaker —
// Apple Pay/Google Pay/SCA restent de l'infrastructure gérée par My Producer.
//
// "Virement" retiré le 2026-08-27 (Jake ne se souvenait pas d'avoir vraiment
// voulu cette option — pas de cas d'usage identifié).
//
// "PayPal" retiré le 2026-08-27 aussi, pour une raison différente et plus
// définitive : vérifié via l'API Stripe que PayPal ne fonctionne PAS du tout
// sur une charge Connect (Direct Charge ou on_behalf_of) — ni sur le
// checkout classique ("The Paypal payment method does not support Connect
// charges created on behalf of connected accounts, including Direct
// Charges"), ni même comme capacité activable sur le compte connecté
// ("Unknown capability: paypal_payments"), ni proposé dans les moyens de
// paiement automatiques d'un PaymentIntent créé pour ce compte. PayPal ne
// fonctionne que quand la plateforme elle-même est le marchand du paiement
// (l'ancien modèle destination charge) — incompatible avec l'architecture
// cible de la Phase 2. Apple Pay/Google Pay ne sont pas concernés (réseaux
// de carte, pas des processeurs indépendants comme PayPal).
//
// Seule 'carte' (baseline, non désactivable) reste un choix pour l'instant —
// structure gardée telle quelle pour accueillir un futur moyen de paiement
// réellement compatible Direct Charge, plutôt que d'être simplifiée à un
// simple booléen.
//
// Cette couche de mapping existe pour ne jamais injecter le tableau UI
// directement dans les paramètres Stripe (cf. plan Phase 2, correction du
// Grill Me) : le Niveau A ne change qu'ici, jamais dans les routes de
// checkout elles-mêmes.

export type MoyenPaiementNiveauA = 'carte'

export const MOYENS_PAIEMENT_TOGGLABLES: MoyenPaiementNiveauA[] = []

// Carte toujours active — baseline, jamais désactivable (pas de config
// checkout vide possible).
export const MOYEN_PAIEMENT_BASELINE: MoyenPaiementNiveauA = 'carte'

export function normaliserMoyensPaiement(input: unknown): MoyenPaiementNiveauA[] {
  const valides = new Set<MoyenPaiementNiveauA>(['carte'])
  const choisis = Array.isArray(input) ? input.filter((m): m is MoyenPaiementNiveauA => valides.has(m)) : []
  return [...new Set([MOYEN_PAIEMENT_BASELINE, ...choisis])]
}

// Niveau B — Checkout Session classique (redirection).
export function mapperVersPaymentMethodTypes(moyens: MoyenPaiementNiveauA[]): ('card')[] {
  void moyens
  return ['card']
}
