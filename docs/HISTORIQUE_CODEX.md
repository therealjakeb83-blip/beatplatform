# Historique consolidé Beatplatform × Codex

Dernière consolidation : 18 septembre 2026.

Ce document donne une vue lisible du travail enregistré depuis le début de l'utilisation de Codex sur Beatplatform. Le détail opérationnel et les décisions session par session restent dans `ROADMAP.md`; l'historique Git reste la source exacte des changements de code.

## Vue d'ensemble

Beatplatform est devenu un SaaS complet de boutiques pour beatmakers autour de quatre ensembles : boutique et checkout, outil Business/CRM, paiements et conformité, administration de la plateforme. Le socle repose sur Next.js, Supabase, Stripe Connect, Resend et la génération de documents PDF.

## Chronologie consolidée

### Mai–juin 2026 — CRM, commerce et analytics

- Construction du CRM : contacts, leads, clients, fiches détaillées, statuts, préférences, segmentation, listes et fusion/défusion de doublons.
- Branchement des téléchargements gratuits et des signaux boutique au CRM.
- Construction de Commerce : commandes, abonnements, plans, beats, licences, codes promo et collaborations.
- Construction des analytics : ventes, revenus, abonnements, préférences, codes promo et détail par beat, avec correction durable des unités euros/centimes.
- Ajout du tracking d'acquisition, des écoutes, de leur durée et des sources marketing.

### Juillet 2026 — Marketing, automatisations et administration

- Campagnes email avec ciblage, templates par blocs, variables, aperçu, tracking, désinscription RGPD et attribution des conversions.
- Automatisations marketing et emails transactionnels.
- Catégories et demandes de certification.
- Back-office Admin : recherche, journaux Stripe, suspension, analytics plateforme et suivi des emails.
- Abonnement de la plateforme pour les beatmakers, essai gratuit et contrôle d'accès.
- Début de la refonte complète de la boutique publique, mesurée directement contre les maquettes.

### Août 2026 — Boutique, paiements express et conformité

- Refonte du sélecteur de licence, du panier, de la fiche produit et ajout des réductions par lot.
- Paiements express Apple Pay, Google Pay et Link; fiabilisation du calcul du montant avant ouverture d'un wallet.
- Audit juridique/fiscal « article 9 bis » et plan en 13 phases.
- Passage des ventes simples en Stripe Direct Charge, remboursement Stripe réel, snapshots transactionnels et versionnage des pages légales.
- Facturation PDF et mandat de facturation.
- Fuseau horaire par beatmaker dans les affichages et périodes analytics.
- Gestion des litiges Stripe et historique des paiements d'abonnement échoués.

### Septembre 2026 — Checkout custom et robustesse des données

- Nouvelle page de paiement custom mobile puis desktop, avec carte, wallets, récapitulatif, promotions, TVA et formulaire particulier/professionnel.
- Google Pay activé de façon fiable sur les configurations Stripe Connect; logique Apple Pay/Google Pay partagée entre panier et checkout.
- Email du compte connecté propagé au checkout et normalisation de tous les emails en minuscules, y compris migration des données existantes.
- Newsletter du checkout réellement branchée après paiement : un opt-in coche l'inscription; l'absence de coche ne désinscrit jamais un client déjà inscrit; un nouveau client non coché reste désinscrit. Les trois scénarios ont été validés en production de test.
- Identité CRM au paiement : si une session artiste existe, son compte et son email priment sur l'adresse saisie au checkout. Ce comportement a été diagnostiqué puis confirmé comme règle produit voulue.
- Zoom mobile : abandon du blocage global, trop agressif pour l'accessibilité et contournable sur iOS; conservation du pinch-to-zoom et prévention best effort du double-tap accidentel via `touch-action: manipulation`.
- Facturation B2B : raison sociale et numéro de TVA transportés dans le paiement puis figés sur la commande. Ils apparaissent sur la facture et dans le détail de commande du beatmaker, sans enrichir durablement la fiche CRM client. La migration `supabase/facturation_acheteur_snapshot.sql` a été appliquée.

## Règles produit durables

- Une session artiste connectée est l'identité de référence pour la commande et le CRM.
- Le consentement newsletter est explicite et monotone au checkout : cocher peut inscrire, ne pas cocher ne révoque pas un consentement existant.
- Les emails sont normalisés en minuscules à la saisie, au stockage et à la comparaison.
- Les données professionnelles de facturation sont un snapshot de commande, pas des attributs CRM permanents.
- Les montants des wallets ne deviennent utilisables qu'après synchronisation avec le prix recalculé côté serveur.
- Sur mobile, le pinch-to-zoom reste disponible; seul le double-tap accidentel est limité au mieux des possibilités du navigateur.

## Sources de vérité

- `ROADMAP.md` : état détaillé, priorités et journal des sessions.
- `DATABASE.md` : schéma métier et conventions de données.
- `CLAUDE.md` : architecture et règles de reprise pour les assistants.
- `HANDOFF_CLAUDE_CHECKOUT_2026-09-11.md` : diagnostic détaillé du checkout et de Google Pay.
- `HANDOFF_CLAUDE_ROADMAP_2026-09-18.md` : brief destiné à la mise à jour de la roadmap human-friendly avec Claude Artifacts.
- Git : historique exact des changements et validations documentaires.

