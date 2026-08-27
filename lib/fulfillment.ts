// Mandat de fulfillment — instruction du beatmaker à My Producer sur la
// livraison automatique des ventes. La définition technique de ce qui
// constitue un paiement valide (contrôles anti-fraude, sécurité) reste du
// ressort de My Producer, documenté comme tel dans le texte lui-même —
// décision du Grill Me du 2026-08-08 (voir memory/project_grillme_9bis_synthese.md).
//
// Versionné (pas juste un booléen) : si le texte change un jour, les mandats
// déjà acceptés gardent leur version d'origine, et le snapshot transactionnel
// (Phase 4) pourra figer la version applicable à chaque commande.

export const MANDAT_FULFILLMENT_VERSION_ACTUELLE = 1

export const MANDAT_FULFILLMENT_TEXTES: Record<number, string> = {
  1: `Dès qu'un paiement est confirmé par Stripe, My Producer livre automatiquement à l'acheteur les fichiers audio et le contrat de licence correspondants, sans validation manuelle de ta part au cas par cas.

La définition technique de ce qui constitue un paiement valide (contrôles anti-fraude, vérifications de sécurité) reste de la responsabilité de My Producer.

Ce mandat est persistant : tu n'as pas à le reconfirmer à chaque vente. Tu peux le révoquer à tout moment depuis cette page — la révocation ne s'applique qu'aux ventes futures, jamais rétroactivement aux commandes déjà livrées.`,
}

export function texteMandatFulfillment(version: number): string {
  return MANDAT_FULFILLMENT_TEXTES[version] ?? MANDAT_FULFILLMENT_TEXTES[MANDAT_FULFILLMENT_VERSION_ACTUELLE]
}
