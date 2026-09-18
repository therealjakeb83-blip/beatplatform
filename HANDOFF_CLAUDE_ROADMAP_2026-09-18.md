# Brief Claude Artifacts — roadmap human-friendly Beatplatform

Date : 18 septembre 2026.

## Mission

Mettre à jour l'Artifact « roadmap / où en est Beatplatform » pour qu'une personne non technique comprenne immédiatement : ce qui fonctionne déjà, ce qui est en cours, ce qui reste à faire avant le lancement et ce qui est volontairement reporté.

## Sources à lire avant toute modification

1. `ROADMAP.md` — source de vérité détaillée pour les statuts et les priorités.
2. `docs/HISTORIQUE_CODEX.md` — synthèse chronologique et règles produit durables.
3. `CLAUDE.md` — architecture et contraintes importantes.
4. `DATABASE.md` — uniquement pour vérifier une affirmation liée aux données.
5. `HANDOFF_CLAUDE_CHECKOUT_2026-09-11.md` — contexte détaillé du checkout et de Google Pay.

Ne pas déduire un statut à partir d'une ancienne maquette ou d'une mémoire isolée. En cas de contradiction, privilégier l'entrée la plus récente de `ROADMAP.md`, puis l'historique Git.

## État récent à refléter

- Checkout custom mobile et desktop livré.
- Panier aligné avec le checkout : code promo dépliable, email conditionnel, email connecté transmis, wallets correctement dimensionnés.
- Newsletter checkout branchée et validée sur les trois scénarios métier.
- Compte connecté prioritaire pour rattacher une commande au CRM; comportement voulu.
- Facturation professionnelle corrigée : raison sociale et TVA visibles sur facture et détail de commande, snapshot par commande, migration appliquée.
- Politique mobile : pinch-to-zoom conservé; limitation du double-tap accidentel seulement.
- Normalisation globale des emails en minuscules terminée et migration exécutée.
- Priorité de fond inchangée : terminer les phases fonctionnelles/juridiques du chantier 9 bis avant les grands chantiers UX/UI restants.

## Format recommandé pour l'Artifact

Créer une vue courte, visuelle et maintenable :

- un en-tête « Où on en est » daté;
- quatre compteurs ou cartes : Terminé, En cours, Bloqué/attente externe, Plus tard;
- une frise par grands chantiers, pas par commit;
- une section « Prochaines 3 étapes »;
- une section « Validé récemment » limitée aux changements qui ont un impact produit;
- une section « Décisions à ne pas rouvrir sans raison » reprenant les règles durables;
- des libellés compréhensibles sans connaître Stripe, Supabase ou Next.js.

## Ton et règles éditoriales

- Français simple, phrases courtes, aucun jargon non expliqué.
- Montrer le bénéfice utilisateur avant le détail technique.
- Distinguer clairement « codé », « testé », « validé par Jake » et « à vérifier avant le live ».
- Ne pas gonfler artificiellement le pourcentage d'avancement : les refontes Landing, Business, Dashboard, l'Onboarding, les tests complets, la sécurité et le déploiement restent des chantiers importants.
- Ne pas présenter la plateforme comme lancée.
- Garder la roadmap détaillée dans Git; l'Artifact est sa vue human-friendly, pas une deuxième source de vérité.

## Livrable attendu

Mettre à jour l'Artifact existant si son lien est disponible. Sinon, produire un nouvel Artifact autonome et ajouter dans ce fichier son titre, son URL et sa date de dernière synchronisation.

