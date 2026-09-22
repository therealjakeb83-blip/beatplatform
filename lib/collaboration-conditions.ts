// Conditions de collaboration entre beatmakers — texte de la PLATEFORME que le
// collaborateur (B) accepte, en une seule case, avant d'entrer dans une
// collaboration (Phase 12, décisions Q8/Q10 du 2026-09-21). Ce n'est PAS le
// contrat de licence de A ni ses CGV (versionnés à part, Phases 1 et 6).
//
// La version acceptée est enregistrée sur la collaboration (snapshot :
// beat_splits.conditions_version) — pas de ré-acceptation forcée. Pour publier
// une nouvelle version : ajouter une entrée, monter la constante ACTUELLE ; les
// collaborations déjà acceptées gardent la version qu'elles ont acceptée.
//
// ⚠️ TEXTE PROVISOIRE : hypothèses de produit validées par Jake seul, aucun
// avis juridique professionnel à ce jour. À faire relire avant le lancement.

export const CONDITIONS_COLLAB_VERSION_ACTUELLE = 1

type ConditionsCollab = {
  // Les points clés, toujours visibles à côté de la case à cocher.
  resume: string[]
  // Le texte complet, dépliable.
  complet: { titre: string; paragraphes: string[] }[]
}

export const CONDITIONS_COLLAB_TEXTES: Record<number, ConditionsCollab> = {
  1: {
    resume: [
      'Ta part est fixée à l’invitation et ne change plus : pour la modifier, tu quittes la collaboration puis on te ré-invite.',
      'Chaque vente est répartie directement entre les vendeurs selon les parts, calculées sur le prix réellement payé par l’acheteur.',
      'Tu donnes mandat au propriétaire du beat pour gérer la vente : prix, promotions, publication, remboursements. Tu peux quitter la collaboration à tout moment.',
      'Le propriétaire peut mettre fin à ta collaboration ; les ventes déjà faites ne changent pas.',
      'Ton nom d’artiste apparaît publiquement en « ft. » sur le beat tant que tu es actif.',
      'Chacun est responsable de sa propre fiscalité et de sa propre facture pour sa part.',
    ],
    complet: [
      {
        titre: '1. Ta part',
        paragraphes: [
          'Ta quote-part est celle qui figure dans l’invitation. Elle est calculée sur le prix réellement payé par l’acheteur, après remises éventuelles (code promo, réduction par lot, remise membre), taxes incluses puisque la TVA est comprise dans le prix affiché.',
          'Chaque part, y compris celle du propriétaire, vaut au moins 10 % et au moins 1 € par vente. Le prix du beat ne peut donc pas descendre sous un prix minimum calculé à partir de la plus petite part, sauf s’il est offert (0 €).',
          'La répartition n’est jamais renégociée : si elle doit changer, tu quittes la collaboration (ou le propriétaire y met fin), puis une nouvelle invitation est envoyée.',
        ],
      },
      {
        titre: '2. Encaissement et frais',
        paragraphes: [
          'Chaque vendeur encaisse directement sa part sur son propre compte de paiement Stripe. Les frais de traitement Stripe sur ta part sont à ta charge.',
          'Tu ne peux accepter qu’une fois ton compte de paiement, ta facturation et tes informations fiscales complètement configurés.',
        ],
      },
      {
        titre: '3. Mandat donné au propriétaire du beat',
        paragraphes: [
          'En acceptant, tu donnes mandat au propriétaire du beat pour gérer la vente : prix, promotions, publication, décisions de remboursement et gestion des fichiers et des licences. Ce mandat est indissociable de la collaboration : le retirer revient à quitter la collaboration.',
          'Le propriétaire est seul concédant de la licence vendue à l’acheteur et seul maître de la vente. Tu n’es pas partie au contrat de licence en qualité de concédant, mais tu es vendeur de ta part et tu émets ta propre facture pour cette part.',
          'Les téléchargements gratuits sont décidés par le propriétaire seul. Un beat en collaboration ne peut pas faire partie des beats offerts par un abonnement de boutique (beat cadeau de fidélité).',
        ],
      },
      {
        titre: '4. Remboursements',
        paragraphes: [
          'Le propriétaire reste maître des décisions de remboursement de la vente. En cas de remboursement, chaque part est remboursée proportionnellement à la répartition en vigueur au moment de la vente.',
          'Tu peux rembourser ta propre part depuis ton compte Stripe. Tu restes redevable de ta part d’un remboursement même si ton solde Stripe est insuffisant à ce moment.',
        ],
      },
      {
        titre: '5. Départ et éviction',
        paragraphes: [
          'Tu peux quitter la collaboration à tout moment : le beat reste en vente et le propriétaire reprend 100 % des ventes futures. Les ventes passées ne changent pas.',
          'Le propriétaire peut mettre fin à ta collaboration ; tu en es prévenu immédiatement avec le motif indiqué. Le beat reste en vente, les ventes passées ne changent pas. Cette décision commerciale ne règle pas, à elle seule, les droits de propriété intellectuelle réels entre vous.',
          'Tant qu’un beat n’est pas accepté par tous ses collaborateurs, il n’est pas en vente. Si le propriétaire retire l’invitation, le beat repart en vente avec sa seule part.',
        ],
      },
      {
        titre: '6. Ton nom',
        paragraphes: [
          'Ton nom d’artiste apparaît publiquement en « ft. » sur le beat tant que ta collaboration est active. Les contrats et factures déjà émis conservent ton nom.',
        ],
      },
      {
        titre: '7. Évolution de ces conditions',
        paragraphes: [
          'La plateforme peut faire évoluer ces conditions. Toute mise à jour t’est communiquée par email à titre informatif, avec un préavis de 30 jours avant son entrée en vigueur ; tu n’as rien à accepter de plus. Si tu n’es plus d’accord, tu peux te retirer de la collaboration ou quitter la plateforme. Les ventes réalisées avant l’entrée en vigueur restent régies par la version qui s’appliquait alors.',
          'Aucune mise à jour ne peut modifier la répartition convenue entre collaborateurs.',
        ],
      },
      {
        titre: '8. Responsabilité fiscale',
        paragraphes: [
          'Chacun est responsable de sa propre situation fiscale (TVA, impôts, déclarations) pour la part qu’il perçoit. La plateforme n’est pas partie à la relation entre collaborateurs et ne donne aucun conseil juridique ou fiscal.',
        ],
      },
    ],
  },
}

export function conditionsCollab(version: number): ConditionsCollab {
  return CONDITIONS_COLLAB_TEXTES[version] ?? CONDITIONS_COLLAB_TEXTES[CONDITIONS_COLLAB_VERSION_ACTUELLE]
}
