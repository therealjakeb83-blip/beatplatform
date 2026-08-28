// Détail HT/TVA d'un prix déjà TTC (TVA toujours absorbée, jamais ajoutée
// — voir lib/pricing.ts). Purement informatif pour le client au moment
// d'acheter (popup licence, panier, page abonnement) : ne modifie jamais le
// montant réellement facturé, qui reste toujours le prix affiché tel quel.

export function detailTva(
  prixEuros: number,
  info: { tvaActive: boolean; tvaTaux: number | null }
): { montant: number; taux: number } | null {
  if (!info.tvaActive || !info.tvaTaux) return null
  const montant = prixEuros - prixEuros / (1 + info.tvaTaux / 100)
  return { montant: Math.round(montant * 100) / 100, taux: info.tvaTaux }
}

// Description Stripe d'un abonnement (page de paiement hébergée) —
// concatène la description du beatmaker et la mention TVA, sans jamais
// modifier le prix. Partagé entre /api/stripe/abonnement/plan (changement de
// prix/description) et /api/stripe/tva (changement de réglage TVA seul).
export function descriptionAvecTva(
  description: string | null,
  prixCents: number,
  info: { tvaActive: boolean; tvaTaux: number | null }
): string {
  const tva = detailTva(prixCents / 100, info)
  const mentionTva = tva ? `TTC · dont TVA (${tva.taux}%) : ${tva.montant.toFixed(2).replace('.', ',')}€` : null
  const base = description ?? ''
  return [base, mentionTva].filter(Boolean).join(base && mentionTva ? ' — ' : '')
}
