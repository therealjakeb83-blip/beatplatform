// LTV du CRM = ce que le client a dépensé chez ce beatmaker depuis le début
// (décision de Jake, Phase 13 lot 5) : valeur du client, pas revenu du
// vendeur (≠ Analytics, qui comptent la part de chacun). Licences, créations
// et renouvellements d'abonnement compris ; vente collab = prix TOTAL payé
// par le client ; moins ce qui lui a été rendu (remboursement total ou
// partiel, litige perdu) ; litige en cours = encore dépensé ; offert = 0.
const STATUTS_AVEC_DEPENSE = new Set(['payee', 'litige', 'remboursee_partielle', 'remboursement_incomplet'])

export type CommandeDepense = {
  statut: string
  prix_paye: number | string | null
  montant_rembourse_cents?: number | null
}

function centsDepenses(c: CommandeDepense): number {
  if (!STATUTS_AVEC_DEPENSE.has(c.statut)) return 0
  return Math.max(Math.round(Number(c.prix_paye ?? 0) * 100) - (c.montant_rembourse_cents ?? 0), 0)
}

export function montantDepense(c: CommandeDepense): number {
  return centsDepenses(c) / 100
}

export function totalDepense(commandes: CommandeDepense[]): number {
  return commandes.reduce((s, c) => s + centsDepenses(c), 0) / 100
}

// Panier moyen = dépense moyenne par achat de licence qui a coûté quelque
// chose au client (un achat remboursé en entier ou offert n'en est pas un).
export function panierMoyenLicences(licences: CommandeDepense[]): number | null {
  const avecDepense = licences.filter(c => centsDepenses(c) > 0)
  return avecDepense.length ? Math.round(totalDepense(avecDepense) / avecDepense.length) : null
}
