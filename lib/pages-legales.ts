import { NOM_PLATEFORME } from './constantes'

export type TypePageLegale = 'cgv' | 'mentions_legales' | 'confidentialite' | 'contact' | 'plan_de_site'

export const TYPES_PAGES_LEGALES: { type: TypePageLegale; titre: string; route: string }[] = [
  { type: 'cgv', titre: 'Conditions générales de vente', route: 'cgv' },
  { type: 'mentions_legales', titre: 'Mentions légales', route: 'mentions-legales' },
  { type: 'confidentialite', titre: 'Politique de confidentialité', route: 'confidentialite' },
  { type: 'contact', titre: 'Contact', route: 'contact' },
  { type: 'plan_de_site', titre: 'Plan de site', route: 'plan-de-site' },
]

export type InfosLegalesBeatmaker = {
  nom_artiste: string
  raison_sociale: string | null
  numero_entreprise: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  email_contact_public: string | null
}

export const CHAMPS_INFOS_LEGALES: { cle: keyof InfosLegalesBeatmaker; label: string; placeholder: string }[] = [
  { cle: 'raison_sociale', label: 'Nom légal / raison sociale', placeholder: 'ex: Jean Dupont, ou Dupont Prod SASU' },
  { cle: 'numero_entreprise', label: 'SIRET (si applicable)', placeholder: '123 456 789 00012' },
  { cle: 'adresse', label: 'Adresse', placeholder: '12 rue des Beats' },
  { cle: 'code_postal', label: 'Code postal', placeholder: '75001' },
  { cle: 'ville', label: 'Ville', placeholder: 'Paris' },
  { cle: 'email_contact_public', label: 'Email de contact (affiché publiquement)', placeholder: 'contact@tondomaine.com' },
]

// Modèles de départ proposés par My Producer — le beatmaker peut les
// adopter tels quels, les modifier librement, ou repartir de zéro (Phase 1
// de la refonte article 9 bis, décision "licences éditables" du Grill Me
// appliquée ici aux CGV). Ce ne sont pas des textes juridiques définitifs :
// à faire relire par un professionnel avant un vrai lancement commercial.
//
// Les {{variables}} sont résolues à partir des infos du beatmaker au
// moment de l'enregistrement (resoudreVariables ci-dessous) — figées dans
// le texte sauvegardé, jamais une référence "live" : si le beatmaker met
// à jour son SIRET plus tard, ses pages déjà publiées ne changent pas
// silencieusement (même principe que le snapshot transactionnel prévu en
// Phase 4 du plan de refonte).
export function texteTemplate(type: TypePageLegale, nomArtiste: string, slug: string): string {
  const url = `${slug}`

  switch (type) {
    case 'cgv':
      return `CONDITIONS GÉNÉRALES DE VENTE

Vendeur : {{raison_sociale}}{{numero_entreprise_ligne}}
Adresse : {{adresse_complete}}

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
Les produits vendus sur cette boutique sont des fichiers numériques livrés immédiatement après paiement. Sauf erreur manifeste du vendeur (fichier corrompu, absent, ou non conforme à la commande), aucun remboursement n'est accordé une fois le téléchargement effectué, conformément à la renonciation au droit de rétractation mentionnée à l'article 5. Le vendeur peut modifier cette politique à tout moment (par exemple pour accorder des remboursements dans d'autres cas).

7. Contact
Pour toute question relative à une commande : {{email_contact}}

8. Droit applicable
Les présentes conditions sont soumises au droit français.`

    case 'mentions_legales':
      return `MENTIONS LÉGALES

Éditeur de la boutique
{{raison_sociale}}{{numero_entreprise_ligne}}
{{adresse_complete}}
Contact : {{email_contact}}

Cette boutique est un produit vendu par {{raison_sociale}}. ${NOM_PLATEFORME} fournit l'infrastructure technique (hébergement, paiement, outils de vente) utilisée par le vendeur pour exploiter cette boutique.

Hébergement
Ce site est hébergé par les prestataires techniques de ${NOM_PLATEFORME}.

Propriété intellectuelle
Sauf mention contraire, les contenus proposés à la vente sur cette boutique sont la propriété du vendeur ou de ses ayants droit.`

    case 'confidentialite':
      return `POLITIQUE DE CONFIDENTIALITÉ

{{raison_sociale}} (ci-après "le vendeur") collecte certaines données personnelles des clients de cette boutique (nom, email, informations de commande) dans le cadre du traitement des commandes et de la relation client.

Ces données sont nécessaires à l'exécution des commandes (livraison des fichiers, facturation) et sont utilisées pour communiquer avec le client au sujet de sa commande. Elles ne sont pas cédées à des tiers à des fins commerciales. Le vendeur peut modifier cette politique à tout moment (par exemple pour ajouter une communication marketing avec consentement préalable).

Le paiement est traité par un prestataire de paiement tiers, qui applique sa propre politique de confidentialité.

Conformément au Règlement Général sur la Protection des Données (RGPD), le client dispose d'un droit d'accès, de rectification et de suppression de ses données personnelles. Pour exercer ce droit, il peut contacter le vendeur à {{email_contact}}.`

    case 'contact':
      return `CONTACT

Pour toute question concernant une commande, une licence ou cette boutique, tu peux contacter ${nomArtiste} :

Email : {{email_contact}}
{{adresse_ligne_optionnelle}}`

    case 'plan_de_site':
      return `PLAN DE SITE

- Boutique — /${url}
- Conditions générales de vente — /${url}/cgv
- Mentions légales — /${url}/mentions-legales
- Politique de confidentialité — /${url}/confidentialite
- Contact — /${url}/contact`
  }
}

const PLACEHOLDER = '[à compléter]'

// Résout les {{variables}} d'un template à partir des infos du beatmaker.
// Appelée au moment de l'enregistrement (dashboard) : le texte sauvegardé
// est toujours une valeur figée, jamais une référence live vers le profil
// du beatmaker.
export function resoudreVariables(texte: string, infos: InfosLegalesBeatmaker): string {
  const numeroEntrepriseLigne = infos.numero_entreprise ? `\nSIRET : ${infos.numero_entreprise}` : ''
  const adresseComplete = [infos.adresse, infos.code_postal, infos.ville].filter(Boolean).join(', ') || PLACEHOLDER
  const adresseLigneOptionnelle = [infos.adresse, infos.code_postal, infos.ville].filter(Boolean).length
    ? `Adresse : ${[infos.adresse, infos.code_postal, infos.ville].filter(Boolean).join(', ')}`
    : ''

  return texte
    .replaceAll('{{raison_sociale}}', infos.raison_sociale || infos.nom_artiste)
    .replaceAll('{{numero_entreprise_ligne}}', numeroEntrepriseLigne)
    .replaceAll('{{adresse_complete}}', adresseComplete)
    .replaceAll('{{adresse_ligne_optionnelle}}', adresseLigneOptionnelle)
    .replaceAll('{{email_contact}}', infos.email_contact_public || PLACEHOLDER)
}

export function infosLegalesCompletes(infos: InfosLegalesBeatmaker): boolean {
  return Boolean(infos.raison_sociale && infos.adresse && infos.email_contact_public)
}
