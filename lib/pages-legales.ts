import { NOM_PLATEFORME } from './constantes'

export type TypePageLegale = 'cgv' | 'mentions_legales' | 'confidentialite' | 'contact' | 'plan_de_site'

export const TYPES_PAGES_LEGALES: { type: TypePageLegale; titre: string; route: string }[] = [
  { type: 'cgv', titre: 'Conditions générales de vente', route: 'cgv' },
  { type: 'mentions_legales', titre: 'Mentions légales', route: 'mentions-legales' },
  { type: 'confidentialite', titre: 'Politique de confidentialité', route: 'confidentialite' },
  { type: 'contact', titre: 'Contact', route: 'contact' },
  { type: 'plan_de_site', titre: 'Plan de site', route: 'plan-de-site' },
]

// Modèles de départ proposés par My Producer — le beatmaker peut les
// adopter tels quels, les modifier librement, ou repartir de zéro (Phase 1
// de la refonte article 9 bis, décision "licences éditables" du Grill Me
// appliquée ici aux CGV). Ce ne sont pas des textes juridiques définitifs :
// à faire relire par un professionnel avant un vrai lancement commercial.
export function texteTemplate(type: TypePageLegale, nomArtiste: string, slug: string): string {
  const url = `${slug}`

  switch (type) {
    case 'cgv':
      return `CONDITIONS GÉNÉRALES DE VENTE

Vendeur : ${nomArtiste}, ci-après "le vendeur". [À compléter : forme juridique, numéro SIRET si applicable, adresse].

Ces conditions générales de vente s'appliquent à toute commande passée sur cette boutique. ${NOM_PLATEFORME} fournit l'infrastructure technique de cette boutique (hébergement, paiement, livraison des fichiers) pour le compte du vendeur, mais n'est pas partie au contrat de vente conclu entre le vendeur et le client.

1. Produits vendus
Le vendeur propose à la vente des licences d'utilisation de contenus musicaux numériques (fichiers audio et éléments associés), sous différentes formules dont les caractéristiques (formats livrés, droits accordés) sont détaillées sur la fiche de chaque produit.

2. Prix
Les prix sont indiqués en euros, toutes taxes comprises le cas échéant selon le régime de TVA du vendeur. Le vendeur peut proposer des remises ou codes promotionnels à sa discrétion.

3. Commande et paiement
La commande est validée au moment du paiement, effectué par carte bancaire ou tout autre moyen proposé sur la boutique. Le paiement est traité par un prestataire de paiement agréé.

4. Livraison
Les produits étant des fichiers numériques, la livraison est effectuée par téléchargement immédiat après confirmation du paiement, selon les modalités définies par le vendeur pour chaque produit.

5. Droit de rétractation
Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux contenus numériques fournis sur un support immatériel dont l'exécution a commencé avec l'accord du client, qui renonce ainsi expressément à son droit de rétractation.

6. Remboursement
[À compléter par le vendeur : conditions dans lesquelles un remboursement peut être accordé.]

7. Droit applicable
Les présentes conditions sont soumises au droit français.`

    case 'mentions_legales':
      return `MENTIONS LÉGALES

Éditeur de la boutique
${nomArtiste}
[À compléter : forme juridique, numéro SIRET si applicable, adresse, email de contact]

Cette boutique est un produit vendu par ${nomArtiste}. ${NOM_PLATEFORME} fournit l'infrastructure technique (hébergement, paiement, outils de vente) utilisée par le vendeur pour exploiter cette boutique.

Hébergement
Ce site est hébergé par les prestataires techniques de ${NOM_PLATEFORME}.

Propriété intellectuelle
Sauf mention contraire, les contenus proposés à la vente sur cette boutique sont la propriété du vendeur ou de ses ayants droit.`

    case 'confidentialite':
      return `POLITIQUE DE CONFIDENTIALITÉ

${nomArtiste} (ci-après "le vendeur") collecte certaines données personnelles des clients de cette boutique (nom, email, informations de commande) dans le cadre du traitement des commandes et de la relation client.

Ces données sont nécessaires à l'exécution des commandes (livraison des fichiers, facturation) et peuvent être utilisées pour communiquer avec le client au sujet de sa commande. [À compléter par le vendeur : autres usages éventuels, ex. communication marketing, et modalités.]

Le paiement est traité par un prestataire de paiement tiers, qui applique sa propre politique de confidentialité.

Conformément au Règlement Général sur la Protection des Données (RGPD), le client dispose d'un droit d'accès, de rectification et de suppression de ses données personnelles. Pour exercer ce droit, il peut contacter le vendeur via la page Contact de cette boutique.`

    case 'contact':
      return `CONTACT

Pour toute question concernant une commande, une licence ou cette boutique, tu peux contacter ${nomArtiste} directement.

[À compléter par le vendeur : email de contact, ou tout autre moyen de contact souhaité.]`

    case 'plan_de_site':
      return `PLAN DE SITE

- Boutique — /${url}
- Conditions générales de vente — /${url}/cgv
- Mentions légales — /${url}/mentions-legales
- Politique de confidentialité — /${url}/confidentialite
- Contact — /${url}/contact`
  }
}
