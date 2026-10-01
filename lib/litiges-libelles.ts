// Motifs de litige Stripe (dispute.reason) en clair — emails et fiches commande.
const MOTIFS: Record<string, string> = {
  fraudulent: 'Paiement non reconnu (fraude)',
  unrecognized: 'Paiement non reconnu',
  product_not_received: 'Produit non reçu',
  product_unacceptable: 'Produit non conforme',
  duplicate: 'Paiement en double',
  subscription_canceled: 'Abonnement annulé',
  credit_not_processed: 'Remboursement non reçu',
  general: 'Contestation générale',
}

export function libelleMotifLitige(motif: string | null | undefined): string {
  return (motif && MOTIFS[motif]) || 'Contestation de paiement'
}
