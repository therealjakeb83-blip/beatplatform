# My Producer — Roadmap V1

> Dernière mise à jour : 2026-07-24 — **Étape 15 (Admin) : périmètre cadré par interview + scoring pertinence/dangerosité, lot 1 codé puis testé et validé bout en bout par Jake dans la même session (checklist T0-T25, T13/T16 bloqués).** Session en trois temps :
> - **Cadrage** (voir mémoire `project_admin_etape15_scope`) : interview zone par zone (Support, Gestion des boutiques, Analytics plateforme, Mails transactionnels, Autonomie sans session Claude, Rôles/permissions), puis score pertinence/dangerosité (1-5) sur chaque feature retenue. **Exclus définitivement** (dangerosité 4-5) : modifier une boutique à sa place (email/slug/Stripe Connect), supprimer un compte, corriger un statut de split/paiement collab. Nouvelle **zone 15g — Mises à jour/veille technique** née en cours de session (rapport quotidien npm+OSV.dev avec prompt copiable pour une future session Claude, jamais d'auto-apply) — reportée à une prochaine session dédiée.
> - **Lot 1 codé** : recherche multi-critères (`/dashboard/admin/recherche`), log des webhooks Stripe (`/dashboard/admin/stripe-events`), suspendre/réactiver une boutique avec **pause en cascade** des abonnements Stripe — l'abonnement plateforme du beatmaker ET chaque abonnement artiste actif de sa boutique (`pause_collection`, réversible, pas une annulation — garde-fou ajouté par Jake en session : sinon l'argent continue de couler des deux côtés d'une boutique suspendue), et correction de champs bas risque sur un compte client/beatmaker. Détail technique et garde-fous : `lib/admin-boutiques.ts`, `lib/admin-recherche.ts`, migration `supabase/phase15_1_admin_support.sql`.
> - **Tests bout en bout, 3 bugs réels trouvés et corrigés en direct** : (1) l'admin pouvait se suspendre lui-même et se retrouver bloqué hors de `/dashboard/admin` (`estAdmin()` dépend du même statut) — corrigé, `suspendreAction` refuse ce cas ; (2) le webhook Stripe existant `customer.subscription.updated` recalculait toujours le statut depuis `subscription.status` (qui reste `"active"` pendant une pause), écrasant silencieusement `'suspendu'` en `'actif'` et cassant la réactivation réelle côté Stripe — corrigé par un garde-fou dans `traiterMajAbonnement` ; (3) `revalidatePath()` dans les server actions effaçait le rapport de suspension affiché à l'écran juste après l'action (réinitialisation de l'état local du composant client) — retiré des 4 actions concernées. Détail complet dans `project_admin_etape15_scope`. **T13/T16 restent bloqués** (pas de bug — le système d'abonnement plateforme lui-même n'est pas encore construit, zéro ligne active/en_essai sur toute la base).
>
> Dernière mise à jour : 2026-07-23 — **Étape 5v2 (boutique publique) : passe complète de finitions mobile + nouveau panneau player déplié + intégration de la déclinaison Blanche & Noire mise à jour.** Session longue, majoritairement pilotée par des allers-retours visuels avec Jake (captures annotées + comparaisons directes avec la maquette via `dev-browser`) :
> - **Corrections mobile boutique** : bordure de sélection d'une cover coupée en haut (padding-top de `.shop-row` insuffisant pour le `translateY` au survol — `overflow-x:auto` impose implicitement `overflow-y:auto`), rythme vertical entre sections resserré pour coller à la maquette (`margin-bottom` 30→24px, `margin-bottom` du titre de section 18→8px), bug d'étirement de la rangée "type beats" (un nom sur 2 lignes comme "Central Cee" étirait toutes les cartes de la rangée — `align-items:flex-start` + troncature ellipsis du nom).
> - **Zoom desktop 125% figé en dur** : Jake trouvait le rendu desktop plus abouti à 125% de zoom navigateur — plutôt que réajuster des centaines de valeurs px, la propriété CSS `zoom` (pas `transform:scale`, qui ne recalcule pas la mise en page) applique ce rendu par défaut via `body:has(.shop-root){zoom:1.25}`, scopé à `min-width:1280px` (en dessous, la grille déborde une fois zoomée — testé et confirmé).
> - **Header mobile non-sticky** : Jake trouvait l'écran surchargé (déjà tab bar + player) — passé de `position:sticky` à `position:static`, plusieurs allers-retours sur l'espace au-dessus (finalement quasi nul, 0) et la marge hero→titre (`.shop-hero padding-top` 120→144px). **Bug du "bandeau noir" trouvé et corrigé** : le dégradé du hero ne remontait pas assez haut pour couvrir la zone au-dessus du header une fois celui-ci non-sticky, laissant apparaître le fond brut uni de `.shop-root` (`margin-top` du hero ajusté à -95px). Lueur blanche additive ajoutée derrière le header (nouvelle couche de `background` sur `.shop-hero`, dosée en plusieurs itérations).
> - **Bug structurel trouvé sur les rangées défilantes (carrousels)** : les covers/blocs catégories semblaient "mangés" en largeur par rapport à la maquette pendant le scroll horizontal, alors que les valeurs de padding mesurées étaient identiques au repos — cause réelle trouvée après plusieurs fausses pistes (largeur du player, marge du container) : le padding de `.shop-container` (16px) restait fixe des deux côtés **pendant tout le scroll** (hors de la zone défilante), alors que dans la maquette ce padding est sur l'élément qui scroll lui-même et défile avec le contenu. Fix : `.shop-row` casse le padding du conteneur (`margin-inline` négatif) et le réapplique sur lui-même (`padding-inline`) — 32px de largeur utile récupérés pendant le scroll.
> - **Nouveau panneau player mobile déplié** (handoff design fourni par Jake) : tap sur la barre mini-player → panneau plein (cover 170px, favori dédié, barre de progression, shuffle/loop/précédent/play/suivant/prix), fermeture via handle. Décisions produit tranchées avec Jake (absentes du handoff) : loop = repeat-one (pas repeat-all), shuffle = mélange persistant de la file (pas aléatoire à chaque clic), ⏮/⏭ bouclent **toujours** circulairement — "ne jamais laisser l'utilisateur dans le vide" — appliqué aussi à l'auto-avance en fin de piste (avant : silence en bout de file). Favori retiré de la barre repliée (prix + play uniquement) sur demande de Jake après coup.
> - **Déclinaison Blanche & Noire mise à jour** (nouveau handoff fourni par Jake, `tokens-light.css` + `Boutique Blanche(.dc.html)` Mobile/Desktop) : contraste du texte relevé (`--text-3` .55→.7, sous le seuil AA sur fond blanc en dessous de 14px), bordures relevées (.08/.12→.14/.2, invisibles sur blanc avant), gris des dégradés recalculés depuis les `oklch()` de la maquette (ancienne dominante violette parasite retirée), **bug corrigé** : `--style-card-text` jamais surchargé pour ce thème → texte blanc invisible sur les cartes styles (fond clair), ombre légère ajoutée aux cartes/bordure aux style-cards (absent du thème sombre, nécessaire pour se détacher du fond blanc), boutons du header mobile en pastilles pleines noires + icônes blanches (spécifique mobile, le desktop reste fond clair/icône sombre), favori du panneau déplié dont le fond dégradé blanc-sur-blanc était invisible corrigé en dégradé sombre-sur-blanc.
> - **Incident déploiement Vercel récurrent** (webhook GitHub→Vercel manqué plusieurs fois dans la session, comme les fois précédentes) — résolu à chaque fois par un commit vide, vérification systématique du déploiement réel via `dev-browser` avant de confirmer à Jake plutôt que de se fier au commit poussé seul.
>
> Dernière mise à jour : 2026-07-20 — **Phase 7 (Catégories & Certification) + amorce Admin (étape 15) entièrement testées et validées par Jake (checklist T0-T19, 100%).** Suite directe de la session de codage du 2026-07-17, avec plusieurs extensions non planifiées construites pendant les tests eux-mêmes (voir section Phase 7 plus bas pour le détail complet) :
> - **Bug corrigé** : sélectionner un style déjà officiel/certifié sur un beat recréait une fausse catégorie perso en doublon (`synchroniserCategoriesPersonnalisees` ne filtrait pas les noms déjà officiels).
> - **BeatForm** repensé : onglets par type de catégorie (au lieu d'un long flux vertical), sections "Certifiés"/"Mes X" avec recherche + création à la volée, badge "certifié" façon réseaux sociaux.
> - **Images de catégories** (Phase 7.8 bonus, différent du "dashboard tendances" V2 resté non construit) : image officielle gérée par l'admin, image perso pour une catégorie non certifiée, override par boutique d'une image officielle (branding) — table `categories_images_boutique` dédiée.
> - **Renommage d'une catégorie perso** avec cascade atomique sur les beats déjà tagués (fonction Postgres `renommer_categorie_perso`).
> - **Demandes de certification** extraites de `categories.statut` vers une vraie table dédiée `demandes_certification` (historique des rejets conservé, plus jamais perdu).
> - **Regroupement des demandes par nom** (insensible à la casse strictement — "Jerk"/"JERK"/"jerk" mais pas "Jerks") : fusion atomique et set-based (`traiter_groupe_certification`) qui fonctionne même à grande échelle (boucle uniquement sur le nombre de variantes de casse distinctes, jamais sur le nombre de lignes), nom définitif choisi par l'admin à l'approbation, email de notification à tous les beatmakers concernés (demandeurs et non-demandeurs confondus).
> - Vues admin (`/dashboard/admin/categories`) et business (`/dashboard/business/categories`) transformées en véritables outils de gestion : tables avec stats (nombre de beats/ventes/écoutes/CA net), onglet "Demandes" séparé et sélectionnable.
>
> Dernière mise à jour : 2026-07-17 — **Phase 7 (Catégories & Certification) + amorce Admin (étape 15) codées en autonomie, RIEN N'EST TESTÉ PAR JAKE.** Suite directe de la Phase 6 dans la même session (Jake a demandé d'enchaîner sur le plus gros chantier codable sans nouvelle question, en s'appuyant sur les décisions déjà actées le 2026-07-02) :
> - Table `categories` remplace les 4 listes hardcodées de `BeatForm.tsx` ; Ambiances/Instruments restent lecture seule, Styles/Type beat passent en mode hybride (ajout libre + demande de certification) via `lib/categories.ts`.
> - **Restructuration en cours de session** : la modération vivait d'abord dans `/dashboard/business/categories/` (page beatmaker) — Jake a fait remarquer qu'il n'avait aucun moyen d'ajouter/gérer les catégories officielles (plateforme) sans SQL, et a demandé une vraie zone Admin plutôt qu'un bricolage dans la page beatmaker. Créé `/dashboard/admin/` (layout gardé, minimaliste — un seul outil pour l'instant), `lib/admin.ts` (`estAdmin()`, gate par **slug de boutique** `jakeb-test`, pas par email — le premier essai avec l'email supposé de Jake était faux, corrigé en cours de session). `/dashboard/business/categories/` simplifiée pour ne garder que les actions beatmaker.
> - Roadmap elle-même retravaillée : Jake a signalé 5 trous de scope (refonte UX/UI, vrai back-office Admin autonome, templates de branding, personnalisation boutique, nouvelles pages boutique) — regroupés en une nouvelle **Étape 5v2 (Refonte Boutique publique & Design System)**, périmètre de l'**Étape 15 (Admin) élargi**. Ordre validé avec Jake : Admin d'abord, Étape 5v2 ensuite. Détail dans "Ordre de priorité actuel" et section Phase 7 plus bas.
>
> ⚠️ **Rien de tout ça n'a encore été testé.** Jake a interrompu les tests dès le premier essai (ajout d'une catégorie officielle) sur une erreur `Could not find the table 'public.categories'` — **pas un bug de code, la migration `supabase/phase7_categories.sql` n'a jamais été exécutée**. C'est la toute première chose à faire à la prochaine session, avant quoi que ce soit d'autre. Checklist de tests complète en fin de doc (section "Checklist tests Phase 7 + Admin").
>
> Dernière mise à jour : 2026-07-17 — **Phase 6 (Mailing transactionnels) validée : 6.1 à 6.6, 6.8 et 6.9, testées bout en bout par Jake.** 6 emails temps réel fonctionnels et personnalisables (confirmation commande, confirmation abonnement, demande d'annulation avec date de fin d'accès, fin d'abonnement en filet, confirmation de compte artiste, free download), page de réglages en accordéon avec aperçu en direct. Périmètre élargi en 4 vagues dans la même session (titre par email, signature dédiée aux transactionnels distincte de celle des Automatisations, footer réseaux sociaux personnalisable, expéditeur brandé à la boutique) et 11 bugs trouvés et corrigés, dont un vrai bug de fiabilité (emails envoyés en fire-and-forget tués en vol par le runtime serverless Vercel avant de partir) et un problème de compatibilité email découvert en toute fin de session (Gmail bloque le SVG inline ET les images en data URI dans les emails reçus — seule une vraie image hébergée fonctionne). Détail complet dans la section Phase 6 plus bas. **Seule 6.7 reste ouverte** (beat cadeau de fidélité, reporté à une session dédiée — 2 décisions produit encore à trancher avec Jake).
>
> Dernière mise à jour : 2026-07-16 — **Phase 5.7/5.9 (combinaisons entre workflows) terminée : les 17 tests de la checklist sont tous validés.** Revue exhaustive des 21 scénarios de combinaison possibles entre les 7 workflows (docs/automatisations/combinaisons-5.7.md), tranchés un par un avec Jake, codés en autonomie, puis testés en conditions réelles un par un. Conclusion de la revue : **aucun cas rare** — tout se résout de façon déterministe, **Phase 5.8 (IA) n'est donc pas construite** (pas de cas d'usage réel). `lib/automatisations.ts` entièrement restructuré autour d'un système de résolution "par jour et par client" à 2 passes. **6 bugs trouvés et corrigés pendant les tests** (page Contacts cassée par la migration Panier, LTV excluant les abonnements, repli combo D+A à 2 mails, index unique bloquant les réoccurrences légitimes, Relance inactivité qui aurait spammé quotidiennement, recherche par email manquante) + **1 décision produit révisée** (Bienvenue abo + Churn → relance perso au lieu du silence, nouvelle combo `combo_abo_resilie_rapidement`) + **1 nouvelle fonctionnalité** (statut "Paiement en attente" + reprise d'abonnement en self-service côté client) + **préférences musicales pondérées par signal** (achat ×10 / free download ×2 / favori ×1, jamais branché malgré le plan d'origine). Détail complet dans le doc et dans `memory/project_phase5_combinaisons_implementation.md`.
>
> **Bonus non planifié le 2026-07-15/16, déclenché par un bug remonté pendant les tests** : connexion automatique réelle après un nouvel abonnement (avant, le client restait "invité" indéfiniment). 3 bugs trouvés et corrigés — fusion de compte incomplète (`lierCompteClient` oubliait la moitié des tables référençant `clients.id`), course structurelle entre 2 webhooks Stripe et la redirection navigateur (résolue par une fonction Postgres atomique avec verrou, `supabase/fusionner_compte_client.sql`), et 3 itérations pour trouver le bon mécanisme de connexion (verifyOtp côté navigateur, pas côté serveur). Testé et validé bout en bout par Jake. Détail : `memory/project_connexion_auto_abonnement.md`.
>
> Phase 5 (workflows en isolation) reste validée de bout en bout depuis le 2026-07-14 (voir historique) : Bienvenue abonnement, Abonnement en attente, Churn message perso, Remerciement achat (4 paliers), Relance inactivité, Bienvenue perso, Follow-up free download.
>
> **⚠️ Blocage confirmé (2026-07-16) : `myproducer.com` est indisponible.** Le nom "My Producer" n'était déjà pas définitif (voir `memory/project_naming_deferred.md`), mais ce n'était jusqu'ici qu'une hypothèse de renommage esthétique. Ce n'en est plus une : la plateforme n'a **aucun nom de domaine réservable sous son nom actuel**. Ça bloque concrètement 2 choses (voir ordre de priorité ci-dessous) : Phase 4.5 (domaine d'envoi email par boutique — DKIM/SPF/DMARC à configurer sur le domaine définitif) et l'étape 17 (déploiement — achat du nom de domaine). Tout le reste du roadmap est indépendant du nom et peut avancer normalement en attendant.

## Ordre de priorité actuel (2026-07-17)

> Le tableau ci-dessous liste toutes les étapes dans leur ordre de numérotation d'origine — l'ordre réel de traitement recommandé, compte tenu des dépendances et du blocage nom/domaine, est différent. Voici l'ordre à suivre à partir de maintenant :
>
> **Révision 2026-07-24** : audit complet demandé par Jake après avoir buté sur T13/T16 (Admin) — découverte que le système d'abonnement plateforme (beatmaker → My Producer, table `abonnements_plateforme`) n'a **jamais été construit**, alors qu'il est prévu depuis le tout premier schéma SQL (commentaire "essai gratuit 14 jours, CB obligatoire") et n'apparaissait nulle part comme étape dédiée. Aucune urgence réelle (projet privé, aucun utilisateur ne peut tomber dessus), mais insérée en priorité haute car **15d (Analytics plateforme) et l'Étape 14 (Onboarding) en dépendent structurellement** — les construire avant produirait du travail à refaire.

| Ordre | Étape | Pourquoi ce rang |
|---|---|---|
| 1 | **11d Phase 6** — Mailing transactionnels ✅ *(reste 6.7, beat cadeau fidélité — reporté)* | Comble un vrai trou produit visible immédiatement : aucun email de confirmation n'est envoyé après un achat ou un abonnement. Indépendant du nom de domaine (réutilise le même mécanisme d'envoi que Campagnes, déjà fonctionnel sur le domaine temporaire). |
| 2 | **11d Phase 7** — Catégories & Certification ✅ *(codé 2026-07-17, testé et validé 2026-07-20 — checklist T0-T19 à 100%)* | Indépendant du nom. Prérequis fonctionnel à l'étape 15 (la modération des demandes de certification fait partie du périmètre Admin — impossible à construire tant que les demandes elles-mêmes n'existent pas). |
| 3 | **Étape 15 lot 1** — Admin : Recherche/Log Stripe/Suspension ✅ *(codé et testé bout en bout le 2026-07-24 — checklist T0-T25 validée, T13/T16 bloqués)* | Dépendance dure avant l'étape 17, explicitement actée. Dépend de la Phase 7 (rang 2) pour la partie modération. |
| 4 | **Étape 8b — Abonnement plateforme** *(nouvelle, 2026-07-24 — voir note ci-dessus)* | Insérée avant la suite de l'Admin et avant l'Onboarding : 1 plan unique (mensuel/annuel), essai 14 jours + CB obligatoire, accès total ou rien — pas de différenciation de droits pour cette V1. Cadrage + plan technique dans la session du 2026-07-24. Le vrai blocage d'accès (`proxy.ts`) est délibérément différé à un lot séparé, après tests du paiement lui-même — éviter de reproduire l'incident d'auto-verrouillage du jour même. |
| 5 | **Étape 15 lot 2** — Admin : 15d Analytics plateforme + 15e Mails transactionnels | Repoussé après l'Étape 8b (rang 4) : 15d mesure justement le revenu de l'Étape 8b — le construire avant afficherait des zéros indéfiniment. |
| 6 | **Étape 5v2** — Refonte Boutique publique & Design System *(déjà très avancée — CGV/confidentialité/contact/mentions légales/plan de site déjà construits, reste la personnalisation par le beatmaker et le beat cadeau 6.7)* | Chantier indépendant du reste (boutique publique, pas dashboard beatmaker) — peut continuer en parallèle si Jake le souhaite. |
| 7 | **11d Phase 8** — Dashboard business (accueil) | Agrège les KPIs de tous les modules Business, y compris Marketing/Mailing/Catégories/Abonnement plateforme — n'a de sens qu'une fois ces modules construits. |
| 8 | **Étape 14** — Onboarding | Repositionné après l'Étape 8b (rang 4) : le parcours d'inscription doit intégrer l'abonnement plateforme dès sa conception, pas l'ajouter après coup. |
| 9 | **Étape 16** — Tests & corrections bout en bout (absorbe la Phase 4.8) | Après que le plus gros du produit (rangs 1-8) soit construit. Phase 4.8 (tests formels Campagnes) déjà décidée comme fusionnée ici plutôt que traitée séparément (note 2026-07-04). |
| — | **Étape 11.5** — Import CSV BeatStars | Parké séparément — bloqué sur l'obtention d'un vrai CSV côté Jake, pas une question d'ordre. À glisser dès qu'il est disponible. |
| 🔒 | **Nom + domaine de la plateforme** | À trancher par Jake dès que possible — plus ça traîne, plus ça retarde les 2 items ci-dessous. Ne bloque rien d'autre dans cette liste. |
| 10 | **11d Phase 4.5** — Vrai domaine d'envoi par boutique | Bloqué tant que le nom/domaine définitif n'est pas choisi (DKIM/SPF/DMARC à configurer une seule fois, pas avant). |
| 11 | **Étape 17** — Déploiement | Bloqué tant que le nom/domaine définitif n'est pas choisi (achat du nom de domaine) + dépend de l'étape 15 (admin) déjà fait. |

> **Trous de scope identifiés par Jake le 2026-07-17 :**
> 1. **Étape 15 (Admin) trop étroite** — périmètre initial limité à perf SaaS/boutique + modération certification + import BeatStars. Jake veut un vrai back-office autonome : support, gestion des boutiques, analytics à l'échelle plateforme (pas juste par boutique), visibilité sur les mails transactionnels envoyés, et plus largement tout ce qui lui permet de gérer la plateforme sans devoir ouvrir une session Claude pour un problème ou une modification courante. Détail des sous-étapes à établir avant de coder — probable chantier à sous-étapes comme l'a été le module Business (11d).
> 2. **Nouvelle Étape 5v2 — Refonte Boutique publique & Design System.** Constat : les 4 points suivants sont en réalité un seul chantier (mêmes fichiers, mêmes décisions de design system), regroupés en une seule phase plutôt que traités séparément :
>    - Refonte UX/UI de la boutique publique, page par page (aujourd'hui : accueil + page beat + 2 playlists, très minimal)
>    - Templates de branding par boutique
>    - Personnalisation par le beatmaker (couleurs, sections, mise en page...) — **périmètre exact non défini, à trancher au moment de planifier l'Étape 5v2, pas maintenant** (dépend des décisions de design system qui n'existent pas encore)
>    - Nouvelles pages boutique : catalogue par catégories, playlists, FAQ, contact + formulaire, CGV, confidentialité
>    - Objectif affiché par Jake : un vrai site premium par beatmaker, pas juste un catalogue minimal.

## Légende
| Statut | Signification |
|--------|--------------|
| ⬜ À faire | Étape non commencée |
| 🔄 En cours | Étape en cours de développement |
| ✅ Validé | Étape terminée et testée |

---

## Progression globale : 12 / 17 étapes validées (+ 4 bonus, dont 2 en cours)

| # | Étape | Description | Durée est. | Statut |
|---|-------|-------------|-----------|--------|
| 1 | **Setup & infrastructure** | Next.js, Git, GitHub, Supabase, Vercel, Cloudflare | 2-3h | ✅ Validé |
| 2 | **Base de données** | Concevoir et créer toutes les tables (beats, clients, licences, abonnements...) | 3-5h | ✅ Validé |
| 3 | **Authentification** | Inscription / connexion des beatmakers et des artistes. Bouton "Se connecter avec My Producer" dans les boutiques — compte global artiste. "Propulsé par My Producer" discret en bas de chaque boutique. | 3-4h | ✅ Validé |
| 4 | **Gestion des beats** | Upload, infos, fichiers (WAV/MP3/ZIP via Cloudflare R2), licences, organisation du catalogue | 10-15h | ✅ Validé |
| 5 | **Boutique** | Page publique du beatmaker, catalogue, player audio, pages beats | 15-20h | ✅ Validé |
| 5b | **Profil beatmaker** *(bonus)* | Slug personnalisable, logo, tagline, réseaux sociaux — page /dashboard/profil | — | ✅ Validé |
| 6 | **Paiements** | Stripe Connect, checkout, codes promo, TVA optionnelle | 10-15h | ✅ Validé |
| 7 | **Licences & livraison** | Livraison automatique des fichiers après achat. PDF contrat généré automatiquement avec : co-producers listés depuis beat_splits, répartition publishing, splits_snapshot stocké dans commandes. | 5-8h | ✅ Validé |
| 8 | **Abonnements** | Plans d'abonnement par beatmaker, catalogue privé (beats visibles + cadenas), remise % automatique (sauf Illimité/Exclusive), essai gratuit configurable, gestion depuis le dashboard et depuis la boutique | 8-12h | ✅ Validé |
| 8b | **Abonnement plateforme** *(nouvelle, 2026-07-24)* | Ce que le beatmaker paie à My Producer (`abonnements_plateforme`) — jamais construit malgré la table présente depuis le schéma d'origine. V1 minimale : 1 plan mensuel (49,99€) / annuel (499,90€), essai 14j + CB obligatoire, accès total ou rien. Blocage d'accès réel volontairement différé (lot séparé). Voir mémoire `project_abonnement_plateforme_decouverte`. | À estimer | 🔄 Codé le 2026-07-24, pas encore testé — checklist T0-T10 |
| 9 | **Espace client artiste** | Compte My Producer global : inscription/connexion artiste, "Se connecter avec My Producer" dans les boutiques, beats achetés, abonnements actifs multi-appareils, fichiers à télécharger. Favoris : bouton cœur sur les cartes beat, page "Mes favoris". | 5-8h | ✅ Validé |
| 10 | **Split collab** | Stripe Connect pour beatmakers collaborateurs. Deux modes : compte My Producer existant OU invitation par email. Fonds retenus chez Stripe si collab non inscrit, reversés à l'inscription. | 7-10h | ✅ Validé |
| 11 | **CRM** | Liste clients, fiches, import CSV BeatStars. Détection automatique de doublons clients (fuzzy matching). | 5-8h | ✅ Validé |
| 11b | **Résolution client** *(bonus)* | Chaque acheteur (invité ou connecté) reçoit un client_id unique. Résolution par email au checkout, fusion au compte à l'inscription. | — | ✅ Validé |
| 11c | **Optimisation CRM** *(bonus)* | 5 sprints : enrichissement liste/fiche (S1), BDD+LTV réelle (S2), RFM+Dashboard (S3), Email marketing intégré Resend (S4), Écoutes (S5 après étape 13) | — | 🔄 En cours |
| 11d | **Outil Business** *(bonus)* | Migration crm-proto → /dashboard/business. Back-office complet : CRM, Commerce, Analytics, Marketing (sprint dédié). Remplace et absorbe les étapes 12 (emails) et 13 (analytics). | — | 🔄 En cours |
| 12 | **Emails automatiques** | Post-achat, abonnement, renouvellement, annulation *(partiellement couvert par 11d Marketing)* | 4-6h | ⬜ À faire |
| 13 | **Analytics** | Compteur d'écoutes sur les cartes beat et page détail *(analytics back-office couvert par 11d)* | 2-3h | ✅ Validé |
| 14 | **Onboarding** | Parcours guidé de configuration à l'inscription | 5-8h | ⬜ À faire |
| 15 | **Admin** | Back-office plateforme, périmètre cadré en sous-étapes le 2026-07-24 : **15a** Recherche/Support ✅ codé+testé, **15b** Log Stripe ✅ codé+testé, **15c** Suspendre/Réactiver une boutique (cascade Stripe) ✅ codé+testé (3 bugs trouvés et corrigés pendant les tests), **15d** Analytics plateforme ⬜, **15e** Visibilité mails transactionnels ⬜, **15f** Rôles/permissions (reste en V1, gate par slug) — pas prioritaire, **15g** Mises à jour/veille technique ⬜ *(nouvelle zone née le 2026-07-24)*, modération des demandes de certification (catégories, 11d Phase 7) ✅ *(amorcé 2026-07-17, `/dashboard/admin/categories`)*, outil interne d'import BeatStars (script scraping concierge) ⬜. Détail complet + scoring dangerosité : mémoire `project_admin_etape15_scope`. Dépendance dure avant l'étape 17 (déploiement officiel) | 10-15h *(à réviser)* | 🔄 En cours — lot 1 (15a/15b/15c) codé ET testé bout en bout le 2026-07-24 |
| 16 | **Tests & corrections** | Tout tester de bout en bout avant lancement | 8-15h | ⬜ À faire |
| 17 | **Déploiement** | Mise en ligne sur Vercel + nom de domaine | 2-4h | ⬜ À faire |

---

## Stack technique
| Rôle | Service | Plan |
|---|---|---|
| Base de données + Auth | Supabase | Free (→ Pro au lancement prod) |
| Stockage fichiers audio (WAV/MP3/ZIP) | Cloudflare R2 | Free jusqu'à 10GB, puis $0.015/GB |
| Hébergement frontend | Vercel | Hobby (→ Pro au lancement prod) |
| Paiements | Stripe Connect | À la transaction (~1.5% + 0.25€) |
| Emails transactionnels | Resend ou Brevo | Free tier |

> **Budget estimé au lancement** : ~$50-60/mois (Vercel Pro + Supabase Pro + R2)

---

## Total estimé : 105-155h (~4 à 6 mois à 2-3 sessions/semaine)

---

## Détail étape 1 — Setup & infrastructure

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| Installation de Git | 5 min | ✅ Validé |
| Configuration de Git (nom + email) | 5 min | ✅ Validé |
| Installation de Node.js | 10 min | ✅ Validé |
| Création du projet Next.js (`beatplatform`) | 10 min | ✅ Validé |
| Initialisation du repo Git local | 5 min | ✅ Validé |
| Création du repo GitHub et push du code | 10 min | ✅ Validé |
| Créer un compte Supabase (free tier) | 10 min | ✅ Validé |
| Créer le projet Supabase et récupérer les clés de connexion | 15 min | ✅ Validé |
| Installer Supabase dans le projet Next.js | 10 min | ✅ Validé |
| Configurer les variables d'environnement (fichier `.env.local`) | 10 min | ✅ Validé |
| Créer un compte Vercel | 10 min | ✅ Validé |
| Connecter Vercel au repo GitHub | 15 min | ✅ Validé |
| Premier déploiement en ligne | 15 min | ✅ Validé |
| Créer un compte Cloudflare (pour R2 + DNS domaine) | 5 min | ✅ Validé |

---

## Détail étape 2 — Base de données

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| Concevoir le schéma des tables (quelles tables, quels champs) | 30 min | ✅ Validé |
| Créer les 9 tables via SQL (beatmakers, beats, licences, clients, leads, commandes, doublons_ignores, abonnements_plateforme, abonnements_boutique) | 45 min | ✅ Validé |
| Activer Row Level Security (RLS) sur toutes les tables | — | ✅ Validé |
| Ajouter les contraintes et index (unicité, montants, abonnements actifs) | — | ✅ Validé |

---

## Détail étape 3 — Authentification

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| 3.1 — Installer `@supabase/ssr` (sessions côté serveur Next.js) | 5 min | ✅ Validé |
| 3.2 — Configurer Supabase Auth (URL de redirection, confirmation email) | 10 min | ✅ Validé |
| 3.3 — Créer les clients Supabase (helpers browser / serveur / middleware) | 15 min | ✅ Validé |
| 3.4 — Proxy de protection des routes (redirection si non connecté) | 15 min | ✅ Validé |
| 3.5 — Page d'inscription (email + mot de passe + création profil beatmakers) | 30 min | ✅ Validé |
| 3.6 — Page de connexion (email + mot de passe + redirection dashboard) | 20 min | ✅ Validé |
| 3.7 — Déconnexion (bouton + redirection accueil) | 10 min | ✅ Validé |
| 3.8 — Mot de passe oublié (page reset + email via Resend, fix scan Gmail) | 20 min | ✅ Validé |
| 3.9 — Policies RLS (chaque beatmaker accède uniquement à son propre profil) | 20 min | ✅ Validé |
| 3.10 — Test de bout en bout (créer un compte, vérifier table, tester routes) | 20 min | ✅ Validé |

---

## Détail étape 4 — Gestion des beats

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| 4.1 — Configurer Cloudflare R2 (bucket + credentials + variables d'env) | 20 min | ✅ Validé |
| 4.2 — Intégrer le SDK S3 compatible R2 dans Next.js (`@aws-sdk/client-s3`) | 10 min | ✅ Validé |
| 4.3 — Page "Ajouter un beat" — formulaire infos (titre, BPM, clé, tags style/ambiance/instruments/type beat + ajout custom) | 45 min | ✅ Validé |
| 4.4 — Upload des fichiers audio vers R2 (MP3 taguée, MP3 propre, WAV, stems ZIP) — cover convertie en WebP auto | 60 min | ✅ Validé |
| 4.4b — Collaborateurs : split revenus par beat (recherche compte My Producer + invitation email, table beat_splits, Stripe escrow) | 30 min | ✅ Validé |
| 4.4c — (V2) Conversion WAV→MP3 automatique à l'upload (nécessite Vercel Pro) | — | ⬜ V2 |
| 4.5 — Sauvegarde du beat en base de données (table `beats` + `beat_splits`) | 20 min | ✅ Validé |
| 4.6 — Page catalogue dashboard — liste des beats, filtres, statut | 45 min | ✅ Validé |
| 4.7 — Édition et suppression d'un beat | 30 min | ✅ Validé |
| 4.8 — Gestion des licences par beat (activer/désactiver, modifier le prix) | 30 min | ✅ Validé |

---

## Détail étape 5 — Boutique publique

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| 5.1 — RLS Supabase : lecture publique beats/licences/beatmakers pour visiteurs non connectés | 10 min | ✅ Validé |
| 5.2 — Player audio global (PlayerContext + PlayerBar sticky) : play/pause/next/prev/seek/autoplay en fin de beat | 60 min | ✅ Validé |
| 5.3 — Page boutique principale `/[slug]` : header beatmaker (logo, nom, tagline, réseaux) + catalogue grille | 45 min | ✅ Validé |
| 5.4 — Filtres catalogue : recherche par titre, filtre style, filtre type beat | 20 min | ✅ Validé |
| 5.5 — Carte beat : cover avec bouton play overlay, titre, BPM/clé, tags, prix des licences | 30 min | ✅ Validé |
| 5.6 — Page beat individuelle `/[slug]/[beatId]` : cover, infos complètes, bouton play, tableau licences | 45 min | ✅ Validé |
| 5.7 — Lien "Ma boutique ↗" dans le dashboard | 5 min | ✅ Validé |

---

## Détail étape 6 — Paiements

| Sous-étape | Description | Qui | Statut |
|-----------|-------------|-----|--------|
| 6.1 | Créer un compte Stripe + activer Stripe Connect | Jake 👤 | ✅ |
| 6.2 | Intégrer le SDK Stripe dans Next.js | Claude 🤖 | ✅ |
| 6.3 | Onboarding Stripe Connect — le beatmaker lie son compte bancaire depuis le dashboard | Claude 🤖 + Jake 👤 | ✅ |
| 6.4 | Page de checkout — l'acheteur choisit sa licence et paie | Claude 🤖 | ✅ |
| 6.5 | Webhook Stripe — confirmer le paiement et créer la commande en base | Claude 🤖 | ✅ |
| 6.6 | Codes promo — création depuis le dashboard + application au checkout | Claude 🤖 | ✅ |
| 6.7 | TVA optionnelle — le beatmaker active/désactive la TVA sur ses ventes | Claude 🤖 | ✅ |
| 6.8 | Page "Mes commandes" dans le dashboard beatmaker | Claude 🤖 | ✅ |

---

## Détail étape 7 — Licences & livraison

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 7.1 | Ajouter colonne `splits_snapshot` dans la table `commandes` (SQL Supabase) | Jake 👤 | 5 min | ✅ |
| 7.2 | Stocker le `splits_snapshot` dans le webhook au moment de l'achat | Claude 🤖 | 20 min | ✅ |
| 7.3 | Générer les URLs signées R2 pour les fichiers de la licence achetée (MP3 / WAV / Stems selon la licence) | Claude 🤖 | 45 min | ✅ |
| 7.4 | Générer le contrat PDF automatiquement (beat, beatmaker, acheteur, licence, répartition publishing) | Claude 🤖 | 90 min | ✅ |
| 7.5 | Stocker le PDF contrat dans R2 + URL dans la commande | Claude 🤖 | 20 min | ✅ |
| 7.6 | Page de téléchargement sécurisée `/telechargement/[commandeId]` | Claude 🤖 | 45 min | ✅ |
| 7.7 | Afficher bouton "Télécharger ma licence" sur la page beat après paiement réussi | Claude 🤖 | 20 min | ✅ |

> **Note :** L'email de livraison avec le lien de téléchargement est prévu à l'étape 12 (emails automatiques).

---

## Détail étape 8 — Abonnements

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 8.1 | Migration SQL : colonnes `abo_*` dans `beatmakers` + migration `abonnements_boutique` (`client_id` nullable, `acheteur_email`, `acheteur_nom`, `en_essai`, `essai_fin_le`) | Jake 👤 | 10 min | ✅ |
| 8.2 | Page dashboard `/dashboard/abonnement` : configuration du plan (nom, description, prix, remise %, durée d'essai) | Claude 🤖 | 45 min | ✅ |
| 8.3 | Création du produit + prix Stripe pour le plan d'abonnement (API `/api/stripe/abonnement/creer-plan`) | Claude 🤖 | 30 min | ✅ |
| 8.4 | Page `/[slug]/abonnement` : présentation du plan + bouton S'abonner | Claude 🤖 | 30 min | ✅ |
| 8.5 | Checkout Stripe en mode `subscription` avec trial gratuit configurable | Claude 🤖 | 30 min | ✅ |
| 8.6 | Webhook Stripe : `customer.subscription.updated` + `customer.subscription.deleted` (mise à jour statut en BDD) | Claude 🤖 | 30 min | ✅ |
| 8.7 | Cookie de session membre (httpOnly `abo_<slug>`) : posé après paiement réussi, vérifié côté serveur à chaque page | Claude 🤖 | 20 min | ✅ |
| 8.8 | Catalogue privé : beats `prive` visibles par tous (covers, titre, tags) + badge cadenas pour non-abonnés | Claude 🤖 | 30 min | ✅ |
| 8.9 | Section "Réservés aux membres" sur la page boutique principale (`/[slug]`) | Claude 🤖 | 20 min | ✅ |
| 8.10 | Page `/[slug]/membres` : overlay paywall pour non-abonnés, accès complet pour abonnés | Claude 🤖 | 30 min | ✅ |
| 8.11 | Page `/[slug]/mon-abonnement` : statut de l'abonnement, date fin d'essai, lien annulation | Claude 🤖 | 30 min | ✅ |
| 8.12 | Remise abonné sur les fiches beat : prix original barré + prix réduit en indigo + badge "-X% membre" (hors Illimité et Exclusive) | Claude 🤖 | 30 min | ✅ |
| 8.13 | Fix : beats privés incluent `mp3_tague_url` pour les abonnés → lecture audio possible depuis la boutique | Claude 🤖 | 15 min | ✅ |

> **Note :** Le cookie session membre (`abo_<slug>`) est provisoire — remplacé par des comptes Supabase Auth à l'étape 9.
>
> **Décision (2026-07-06) — essai gratuit natif retiré pour la V1 :** en construisant l'automatisation "Abonnement en attente" (Phase 5), découvert qu'un essai gratuit natif Stripe (`trial_period_days`) bloque `invoice.payment_succeeded` tant qu'il dure — donc bloque aussi l'incrémentation de `mois_consecutifs` (compteur de fidélité). Jake a choisi de retirer le champ "Essai gratuit (jours)" et la logique de trial au checkout plutôt que de complexifier le compteur : un beatmaker qui veut offrir un mois gratuit utilisera un code promo à -100% (déjà tracké, déjà limitable par client). Réversible facilement si besoin plus tard : `abo_essai_jours`/`en_essai`/`essai_fin_le` restent en base et tout l'affichage existant (CRM, dashboard abonnements, espace client) continue de fonctionner tel quel — il suffirait de remettre `trial_period_days` au checkout + le champ de réglage sur `/dashboard/business/plans`.
>
> **Bug corrigé (2026-07-06) — course entre webhooks sur la création d'abonnement, en 2 passes :**
> 1. Première hypothèse (partiellement fausse) : `invoice.payment_succeeded` arriverait avant que `/api/stripe/abonnement/succes` (redirection navigateur après paiement, pas garantie) ait créé la ligne `abonnements_boutique`. Corrigé en déplaçant la création dans `checkout.session.completed` (webhook, fiable) — bonne pratique en soi (Stripe recommande de ne jamais compter sur `success_url` pour de la logique critique, seulement l'UX), mais **insuffisant seul**.
> 2. En revérifiant l'ordre réel des événements Stripe pour une nouvelle souscription : `invoice.created` → `invoice.finalized` → `invoice.paid` → **`invoice.payment_succeeded`** → `customer.subscription.created` → **`checkout.session.completed`** (~1s plus tard). `invoice.payment_succeeded` arrive donc **avant** `checkout.session.completed`, pas après — aucun événement "plus tôt" n'existe structurellement pour créer la ligne en premier. Corrigé en rendant `traiterPaiementAbonnement` tolérant : si la ligne n'existe pas encore, il réessaie (5 tentatives, 1,5s d'intervalle) avant d'abandonner, laissant le temps à `checkout.session.completed` d'arriver.
>
> `/api/stripe/abonnement/succes` ne fait toujours plus que poser le cookie de session membre et rediriger (reste une bonne pratique), mais la vraie garantie de fiabilité vient du nouveau mécanisme de réessai, pas de l'ordre des événements webhook (Stripe ne garantit explicitement aucun ordre entre événements différents).
>
> **Fix (2026-07-08) — CTA "essai gratuit" trompeur sur les pages publiques :** conséquence oubliée de la décision du 2026-07-06 ci-dessus — `SAbonnerButton.tsx`, `/[slug]/abonnement` et `/[slug]/membres` affichaient encore "Essayer X jours gratuitement" basé sur `abo_essai_jours`, alors que le checkout n'accorde plus aucun essai réel depuis cette date. CTA simplifié en "S'abonner pour X€/mois" sur les 3 pages ; "1 beat gratuit tous les 4 mois" (texte marketing codé en dur) corrigé pour afficher la vraie récurrence configurée (`abo_recurrence_cadeau_mois`). `abo_essai_jours` retiré des `select()` désormais inutiles (`/[slug]/abonnement`, `/[slug]/mon-abonnement`) — la colonne reste en base, toujours réversible comme prévu.

---

## Détail étape 9 — Espace client artiste

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 9.1 | Migration SQL : RLS policies pour la table `clients` (SELECT/UPDATE sur son propre profil) + policy `abonnements_boutique` pour artistes connectés | Claude 🤖 | 20 min | ✅ |
| 9.2 | Pages auth artiste : `/artiste/connexion` + `/artiste/inscription` — séparées du login beatmaker | Claude 🤖 | 45 min | ✅ |
| 9.3 | Création de compte automatique à l'abonnement : webhook Stripe → créer `auth.user` + entrée `clients` par email | Claude 🤖 | 45 min | ✅ |
| 9.4 | Création de compte automatique à l'achat : même logique dans le webhook `checkout.session.completed` | Claude 🤖 | 20 min | ✅ |
| 9.5 | Remplacer le cookie par la session Supabase Auth dans la boutique (`estAbonne` via auth → clients → abonnements_boutique) | Claude 🤖 | 30 min | ✅ |
| 9.6 | Bouton "Se connecter / Mon compte" dans le header de chaque boutique | Claude 🤖 | 20 min | ✅ |
| 9.7 | Espace client `/mon-compte` : abonnements actifs, historique des achats, fichiers à télécharger | Claude 🤖 | 60 min | ✅ |
| 9.8 | Favoris : table `favoris` + RLS + GRANT authenticated + bouton cœur sur les cartes beat (artiste connecté uniquement) | Claude 🤖 | 30 min | ✅ |
| 9.9 | Page "Mes favoris" dans l'espace client | Claude 🤖 | 20 min | ✅ |

> **Note :** L'étape 9 est entièrement prise en charge par Claude — aucune action manuelle Supabase ou Stripe requise de la part de Jake, sauf validation fonctionnelle de bout en bout.

---

## Détail étape 10 — Split collab

> **Contexte :** La table `beat_splits` et le formulaire d'ajout de collabs existent déjà depuis l'étape 4. Ce qui manque : router réellement l'argent vers plusieurs comptes Stripe après chaque vente, notifier les collabs, et leur donner une vue dans leur dashboard.

> **Modèle économique :** My Producer reste en mode Plateforme (pas Marketplace). Les fonds transitent brièvement par My Producer le temps des virements — My Producer n'est pas deemed supplier et n'est pas responsable de la TVA. Frais de transit Stripe (~0.25%/virement) absorbés par My Producer.

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 10.1 | Migration SQL : ajouter `stripe_transfer_group text` dans `commandes` + créer table `split_payments` avec RLS + GRANT service_role | Jake 👤 | 15 min | ✅ |
| 10.2 | Checkout adapté : beats avec splits → `transfer_group` UUID (pas de `on_behalf_of`). Beats sans splits : comportement inchangé. | Claude 🤖 | 30 min | ✅ |
| 10.3 | Email 1 — Invitation collab : envoyé automatiquement quand un beat passe en `public` avec un collab non inscrit (via Resend) | Claude 🤖 | 30 min | ✅ |
| 10.4 | Webhook `checkout.session.completed` : création `split_payments`, Stripe Transfers immédiats pour comptes connectés, Email 2 "fonds en attente" pour collabs non inscrits | Claude 🤖 | 60 min | ✅ |
| 10.5 | `/dashboard/splits` : vue propriétaire — liste des ventes avec collabs, statut par collaborateur (✅ transféré / ⏳ en attente), montants | Claude 🤖 | 45 min | ✅ |
| 10.6 | `/dashboard/mes-collabs` : vue collab lecture seule — beats en split, propriétaire, %, montants reçus / en attente | Claude 🤖 | 30 min | ✅ |
| 10.7 | Webhook `account.updated` : déblocage automatique des splits en attente quand un beatmaker connecte son Stripe. Jake a ajouté l'événement dans le dashboard Stripe. | Claude 🤖 + Jake 👤 | 45 min | ✅ |
| 10.8 | Cron quotidien `/api/cron/splits-expiration` : rappels email J+30 / J+50, reversal automatique vers beatmaker A à J+60 | Claude 🤖 | 45 min | ✅ |
| 10.9 | **Tests bout en bout** — voir checklist complète ci-dessous | Jake 👤 | 30 min | ✅ |

### Checklist tests 10.9

#### T1 — Email d'invitation collab ✅
- [x] Créer ou modifier un beat, ajouter un collaborateur par **email** (pas encore inscrit sur My Producer)
- [x] Passer le beat en statut `public` → sauvegarder
- [x] Vérifier que l'email d'invitation arrive dans la boîte du collab

#### T2 — Checkout beat avec splits (collab non inscrit) ✅
- [x] Acheter ce beat depuis la boutique avec la carte test `4242 4242 4242 4242`
- [x] Vérifier dans Supabase → table `split_payments` : une ligne avec `statut = en_attente` et `email_invite` rempli
- [x] Vérifier dans Supabase → table `commandes` : colonne `stripe_transfer_group` remplie
- [x] Vérifier que l'email "fonds en attente" (Email 2) est arrivé sur l'adresse du collab

#### T3 — Dashboard propriétaire `/dashboard/splits` ✅
- [x] Connecté en tant que Jake → aller sur `/dashboard/splits`
- [x] La vente apparaît avec le badge ⏳ "Fonds en attente" pour le collab non inscrit
- [x] Les montants distribués / en attente sont corrects

#### T4 — Inscription collab + déblocage automatique ✅
- [x] Le collab crée son compte sur `/inscription` avec la même adresse email
- [x] Le collab connecte son compte Stripe via `/dashboard/paiements`
- [x] Vérifier dans Stripe Dashboard → Transfers qu'un nouveau transfer a été créé automatiquement
- [x] Vérifier dans Supabase → `split_payments` que le statut est passé à `transfere`
- [x] Retourner sur `/dashboard/splits` → statut passé à ✅ Transféré

#### T5 — Dashboard collab `/dashboard/mes-collabs` ✅
- [x] Connecté en tant que beatmaker B (collab) → aller sur `/dashboard/mes-collabs`
- [x] Le beat apparaît avec le % et le montant reçu

#### T6 — Non-régression beat sans collab ✅
- [x] Acheter un beat qui n'a **aucun** collab
- [x] Vérifier que le comportement est inchangé : aucune ligne dans `split_payments`, transfer direct vers Jake dans Stripe

#### T7 — Beat avec collab déjà inscrit (compte Stripe connecté) ✅
- [x] Créer un beat avec un collab qui **a déjà** un compte My Producer + Stripe connecté
- [x] Acheter ce beat
- [x] Vérifier dans Stripe → **2 transfers** créés immédiatement (Jake + collab)
- [x] Vérifier dans `split_payments` → 2 lignes avec `statut = transfere`

> **Politique de rétention des fonds :** Split en attente = fonds détenus par Stripe (pas My Producer). Rappel email à J+30 et J+50. Reversal automatique vers beatmaker A à J+60. À documenter dans les CGU.

> **Note :** Les emails de l'étape 10 sont fonctionnels (contenu simple via Resend). Le design HTML branded sera revu à l'étape 12.

---

## Détail étape 11 — CRM

| # | Sous-étape | Qui | Statut |
|---|-----------|-----|--------|
| 11.1 | Migration SQL : RLS + GRANT sur `doublons_ignores` | Jake 👤 | ✅ |
| 11.2 | Page `/dashboard/crm` : liste clients avec stats (CA, achats, abonnés) + recherche + filtres | Claude 🤖 | ✅ |
| 11.3 | Page `/dashboard/crm/[clientId]` : fiche client avec historique achats + statut abonnement | Claude 🤖 | ✅ |
| 11.4 | Page `/dashboard/crm/doublons` : détection noms similaires + bouton Ignorer | Claude 🤖 | ✅ |
| 11.5 | Import CSV BeatStars | — | ⬜ À faire après analyse du vrai CSV |
| 11.6 | **Tests bout en bout** | Jake 👤 | ✅ |

### Checklist tests 11.6

#### T1 — Liste clients ✅
- [x] Aller sur `/dashboard/crm`
- [x] Les stats s'affichent en haut (nb clients, acheteurs, abonnés, CA total)
- [x] Les clients apparaissent dans la liste avec nom, email, achats, CA

#### T2 — Recherche + filtres ✅
- [x] Taper un nom ou email dans la barre → les résultats se filtrent
- [x] Cliquer sur "Acheteurs" → seuls les clients avec au moins 1 achat
- [x] Cliquer sur "Abonnés" → seuls les abonnés actifs
- [x] Cliquer sur "Leads" → clients sans achat ni abonnement

#### T3 — Fiche client ✅
- [x] Cliquer sur la flèche `→` d'un client avec compte My Producer
- [x] La fiche affiche ses infos (nom, email, pays, date inscription)
- [x] L'historique des achats est correct (beats, licences, montants)
- [x] Le statut abonnement est affiché si applicable

#### T4 — Doublons ✅
- [x] Aller sur `/dashboard/crm/doublons`
- [x] La page charge sans erreur
- [x] Si des noms similaires existent → paires affichées avec bouton "Ignorer"
- [x] Cliquer "Ignorer" → la paire disparaît et ne revient plus

---

## Détail étape 11c — Optimisation CRM

> **Contexte :** Architecture décidée le 2026-05-21 après revue complète du CRM Airtable de Jake (2 300 clients, 4 415 commandes, 434 abonnements). Toutes les données validées une par une (liste vs fiche). 5 sprints planifiés.

### Données dans la liste CRM
Nom · **Statut abonnement** (ABONNÉ/ANCIEN ABONNÉ/JAMAIS ABONNÉ) · **Statut achat** (CLIENT/LEAD) · Langue (FR/US) · Nb achats · LTV · Dernière commande (date relative, hors rnvt) · Style préféré · Type beat préféré · Segment RFM

### Données dans la fiche client (tout ce qui est en liste + )
Email · Pays · Instagram · Adresse complète · Téléphone · Abonnement (statut brut, mois réglés, abonné depuis) · Panier moyen · Type de licence préféré · Codes promo utilisés · Préférences musicales complètes (styles, type beats, ambiances, instruments) · Historique achats détaillé · Beats téléchargés gratuitement non achetés (upsell) · Source d'acquisition · Newsletter consent · Score RFM détaillé

### Deux dimensions de statut indépendantes
**Dimension 1 — Statut abonnement :**
- ABONNÉ = abo actif (payant OU essai gratuit en cours — engagement formel même à 0€)
- ANCIEN ABONNÉ = a eu un abo, plus actif (annulé/expiré/on-hold/essai échoué)
- JAMAIS ABONNÉ = aucun abonnement jamais
- ⚠️ on-hold → ANCIEN ABONNÉ (pas de 4ème statut)

**Dimension 2 — Statut achat :**
- CLIENT = au moins une commande (même à 0€ via promo 100%)
- LEAD = aucune commande, aucun abonnement — dans le funnel uniquement
- La LTV visible permet de trier les clients à 0€ sans badge séparé

### Définition lead
Lead = contact qui a interagi mais n'a jamais acheté ni souscrit.
Sources : `free_download` (signal très fort — travaille avec le beat, veut potentiellement acheter) / `newsletter` (moyen) / `visite` (faible)
Affichage : bloc "X leads à convertir" en haut du CRM + filtre LEAD dans la liste
Transition : lead → client automatique au premier achat (source d'acquisition conservée en fiche)

### Upsell clients existants
Un client peut télécharger d'autres beats gratuitement → afficher dans sa fiche : "A téléchargé gratuitement (non achetés) : Beat X, Beat Y" → opportunité upsell directe

### Autres règles métier
- **LTV** = beats + créations abo + renouvellements. Exclut les remboursements.
- **Dernière commande** = hors renouvellements automatiques (passifs)
- **Mois réglés** = compteur de paiements réels (pas calculé depuis date_debut — faussé par on-hold)
- **Préférences musicales** = achats (poids fort) + favoris (poids moyen) + écoutes (poids faible, étape 13)
- **Score RFM** = Recency + Frequency + Monetary → segments : Champion / Fidèle / À risque / Dormant / À réactiver

---

### Sprint 1 — UI enrichissement (0 nouvelle colonne BDD) ✅ Validé

| # | Sous-étape | Statut |
|---|-----------|--------|
| S1.1 | Liste : requête `beats(styles, type_beat)` sur commandes + `pays` sur clients | ✅ |
| S1.2 | Liste : tracker `derniere_commande`, `a_deja_eu_abo`, `style_prefere`, `type_beat_prefere` par client | ✅ |
| S1.3 | Liste : badge Statut 3 états (ABONNÉ vert / ANCIEN ABONNÉ orange / JAMAIS ABONNÉ gris) | ✅ |
| S1.4 | Liste : nouveaux filtres (Tous / Abonnés / Anciens abonnés / Jamais abonnés / Leads) | ✅ |
| S1.5 | Liste : colonne Langue FR/US | ✅ |
| S1.6 | Liste : colonne Dernière commande (format relatif) | ✅ |
| S1.7 | Liste : colonne Style · Type beat (top 1 chacun) | ✅ |
| S1.8 | Liste : renommage "CA total" → "LTV" | ✅ |
| S1.9 | Fiche : requête favoris → beats(styles, type_beat, ambiances, instruments) via admin | ✅ |
| S1.10 | Fiche : calcul préférences (achats poids 2 + favoris poids 1) | ✅ |
| S1.11 | Fiche : badge Statut client + langue dans l'en-tête | ✅ |
| S1.12 | Fiche : mois réglés dans section abonnement | ✅ |
| S1.13 | Fiche : section "Préférences musicales" (style, type beat, ambiances, instruments) | ✅ |
| S1.14 | Fiche : renommage "CA total" → "LTV" | ✅ |

---

### Sprint 2 — BDD + LTV réelle + données enrichies ✅ Validé

BDD (migration `supabase/sprint2_crm.sql` exécutée) :
- `type_commande` sur `commandes` (LICENCE / CREATION_ABONNEMENT / RENOUVELLEMENT)
- `beat_id` + `licence_id` rendus nullables (commandes d'abonnement sans beat)
- `mensualites_payees integer DEFAULT 0` sur `abonnements_boutique`
- `instagram text` nullable sur `clients`
- `newsletter_consent boolean DEFAULT false` sur `clients`

Fonctionnalités livrées :
- Webhook `invoice.payment_succeeded` → commande CREATION_ABONNEMENT ou RENOUVELLEMENT + incrémente `mensualites_payees` (idempotent via invoice.id)
- Tag `type_commande = LICENCE` sur tous les nouveaux achats beats
- LTV complète (beats + paiements abo) — RENOUVELLEMENT exclu du nb_achats et dernière commande
- Mois réglés exact depuis `mensualites_payees` (avec fallback approx. si 0)
- Instagram éditable dans la fiche CRM (beatmaker uniquement)
- Badge Newsletter dans la fiche client
- Checkbox newsletter_consent à l'inscription artiste
- Toggle newsletter dans /[slug]/mon-compte
- Export CSV subscribers `/api/dashboard/crm/export-newsletter`

---

### Sprint 3 — Score RFM + Dashboard + Vues métier ✅ Validé

Fonctionnalités livrées (0 nouvelle colonne BDD) :
- Score RFM absolu : R/F/M chacun sur 5 → score global /100
- 8 segments automatiques : Champion / Fidèle / Potentiel / À risque / Dormant / À réactiver / Nouveau / Lead
- KPIs ligne 2 (Champions / Fidèles / À risque / Dormants) cliquables → filtre direct
- LTV moyenne ajoutée aux stats
- Section "Actions recommandées" : 3 vues métier contextuelles (clients à relancer / risque de partir / prêts à s'abonner)
- 6 filtres segments dans la liste (+ filtre pret_abo)
- Badge segment coloré dans chaque ligne
- Fiche client : bloc Score RFM avec R/F/M individuels + label (Nul→Excellent) + description du segment
- Fix fiche client : nbAchats exclut désormais les RENOUVELLEMENT (cohérence liste)
- Fix historique : labels corrects pour CREATION_ABONNEMENT et RENOUVELLEMENT

---

### Sprint 4 — Email marketing intégré ⬜ Fusionné dans 11d Phase 4

> **Note (2026-07-02) :** Ce sprint est absorbé par la Phase 4 de l'étape 11d ("Marketing : Fondations + Campagnes") — même socle technique que les Automatisations (Phase 5), donc construit dans le même chantier plutôt qu'isolément. Le contenu ci-dessous reste la référence fonctionnelle du workflow Campagnes.

Envoi de campagnes directement depuis My Producer via Resend, sans export/import manuel.

**Workflow beatmaker :**
1. Crée un segment dans le CRM
2. Choisit un template (nouvelle sortie / relance dormants / offre abonnement...)
3. Personnalise (tokens : `{{prénom}}`, `{{style_préféré}}`, `{{type_beat_préféré}}`...)
4. Envoie → Resend gère la délivrabilité

**Templates** : branding automatique de la boutique (logo, nom, lien boutique)

**Domaine d'envoi :**
- Par défaut : `[slug]@mail.myproducer.com` (zéro action)
- Option avancée : domaine propre du beatmaker
  - ✅ Domaines professionnels uniquement
  - ❌ Messageries publiques bloquées (Gmail, Hotmail, Yahoo, Outlook, iCloud, Orange, Free...)
  - Vérification DNS obligatoire

**RGPD :** envoi uniquement aux `newsletter_consent = true`, lien désinscription obligatoire, mise à jour auto en BDD via webhook Resend.

---

### Sprint 5 — Écoutes intégrées ❌ Abandonné (2026-07-16)

> **Décision Jake :** ne pas ajouter les écoutes (`beat_plays`) comme signal de préférence par client — reste uniquement au niveau Analytics (tracking invités + par client, déjà en place). Contexte : en corrigeant le même jour un bug voisin (favoris/free download jamais branchés dans les préférences malgré le plan d'origine — voir 11d Contacts), la question s'est reposée d'ajouter aussi les écoutes en 4ème signal. Jake a jugé qu'un historique d'écoute brut n'est pas actionnable seul (contrairement à un achat ou un favori), et que la seule vraie utilité (débloquer une préférence pour les purs auditeurs jamais convertis) ne correspond pas à un usage qu'il compte faire. Le compteur de plays **public** (cartes beat/page détail — objectif d'origine de l'étape 13) reste un sujet séparé, non tranché ici.

---

## Détail étape 11d — Outil Business (migration crm-proto)

> **Contexte :** Migration de `c:\Users\nicoj\crm-proto` vers `beatplatform`. L'outil back-office complet s'intègre sous `/dashboard/business/` avec son propre layout et sidebar. Il remplace et absorbe partiellement les étapes 12 (emails) et 13 (analytics back-office). Plan validé le 2026-06-12 après session grill-me.

> **Décisions d'architecture complètes :** voir `memory/project_business_migration_decisions.md`

### Décisions clés

- **Route :** `/dashboard/business/` avec `layout.tsx` dédié + sidebar propre
- **Remplacement :** suppression des anciennes routes après migration (pas de redirections)
- **Codes promo :** table Supabase `codes_promo` + coupon Stripe créé à la volée (pas Stripe seul)
- **Splits :** `/dashboard/splits/` supprimée (sans utilité). Collabs = `/dashboard/business/collabs/` remplace `/dashboard/mes-collabs/`
- **Marketing :** sidebar avec cadenas 🔒, tables DB créées upfront, UI = sprint dédié post-migration
- **Analytics :** réécriture complète en SQL réel — onglet par onglet (Ventes en premier, Vue d'ensemble en dernier)
- **Paiements/Profil :** restent hors business (`/dashboard/paiements/`, `/dashboard/profil/`)

### Phase 0 — Foundation ✅ Validée

| # | Sous-étape | Statut |
|---|-----------|--------|
| 0.1 | Migration SQL `supabase/business_migration.sql` : 6 nouvelles tables + 5 colonnes + RLS | ✅ |
| 0.2 | Layout `app/dashboard/business/layout.tsx` + Sidebar avec auth réelle | ✅ |
| 0.3 | Utilitaires `app/dashboard/business/_lib/utils.ts` : initiales, joursDepuis, formatMontant, compareSigne | ✅ |

**Tables créées :** `codes_promo` · `listes_contacts` · `liste_membres` · `campagnes` · `free_downloads` · `morceaux_clients`

**Colonnes ajoutées :** `clients` (spotify, youtube, tiktok, notes, tags) · `beats` (couleur) · `commandes` (notes) · `abonnements_boutique` (fin_essai, annulation_en_cours)

### Phase 1 — CRM ✅ Complète

| # | Page | Route cible | Remplace | Statut |
|---|------|-------------|----------|--------|
| 1.1 | Contacts (liste) | `/dashboard/business/contacts/` | `/dashboard/crm/` | ✅ |
| 1.2 | Fiche client | `/dashboard/business/contacts/[id]/` | `/dashboard/crm/[clientId]/` | ✅ |
| 1.3 | Doublons | `/dashboard/business/doublons/` | `/dashboard/crm/doublons/` | ✅ |
| 1.4 | Segments | `/dashboard/business/segments/` | *(nouveau)* | ✅ |
| 1.5 | Listes | `/dashboard/business/listes/` | *(nouveau)* | ✅ |

**Suppressions après Phase 1 :** `/dashboard/crm/` (liste, fiche, doublons, email/[encodedEmail])

### Phase 2 — Commerce ✅ Complète

| # | Page | Route cible | Remplace | Statut |
|---|------|-------------|----------|--------|
| 2.1 | Commandes + fiche | `/dashboard/business/commandes/` + `/[id]/` | `/dashboard/commandes/` | ✅ |
| 2.2 | Abonnements | `/dashboard/business/abonnements/` | liste de `/dashboard/abonnements/` | ✅ |
| 2.3 | Plans | `/dashboard/business/plans/` | config de `/dashboard/abonnements/` | ✅ |
| 2.4 | Beats (CRUD) | `/dashboard/business/beats/` | `/dashboard/beats/` (+ sous-routes) | ✅ |
| 2.5 | Licences | `/dashboard/business/licences/` | `/dashboard/licences/` | ✅ |
| 2.6 | Codes promo + fiche | `/dashboard/business/codes-promo/` + `/[id]/` | `/dashboard/codes-promo/` | ✅ |
| 2.7 | Collabs | `/dashboard/business/collabs/` | `/dashboard/mes-collabs/` | ✅ |

**Suppressions après Phase 2 :** ✅ effectuées (`refactor(dashboard): supprimer les pages en double avec business`, 2026-06-26). Il ne reste sous `app/dashboard/` que `business/`, `paiements/`, `profil/` (hors racine et déconnexion).

### Phase 2b — Commerce : Tentatives de paiement 🔴 Priorité (nouveau, 2026-07-04)

> **Contexte :** En creusant le workflow "tentative d'achat échouée" de la Phase 5 (Marketing), Jake a découvert que la page Commandes affiche des onglets "En attente"/statuts qui ne sont **jamais réellement peuplés** — vérifié dans le code : `commandes.statut` est toujours écrit en dur à `'payee'` à la création, dans les deux seuls endroits où une commande est insérée (`app/api/stripe/webhook/route.ts`). Une commande n'existe en base que si le paiement a réussi ; aucun panier abandonné ni paiement échoué n'est tracké nulle part. **Jake considère que régler ça est prioritaire**, avant de reprendre les workflows Marketing. Détail complet des décisions dans `memory/project_commerce_tentatives_paiement.md`.

**Décision d'architecture :** ne pas toucher à `commandes` (contraintes NOT NULL sur `client_id`/`beat_id`/`licence_id`/`prix_paye`, référencée partout — Analytics, CRM LTV/RFM, Codes promo, Splits — en supposant que chaque ligne est une transaction confirmée). Nouvelle table séparée `tentatives_paiement`, sur le modèle Shopify (Checkout ≠ Order) :

```sql
tentatives_paiement (
  id, created_at,
  beatmaker_id (not null), beat_id (not null), licence_id (not null),
  client_id (nullable — résolu si connecté, sinon inconnu tant que Stripe n'a pas renvoyé l'email),
  email (nullable, capturé via Stripe),
  prix (not null),
  stripe_session_id (unique, not null),
  statut ('creee' | 'complete' | 'expiree' | 'echouee'),
  commande_id (nullable, lien vers la commande réelle si succès),
  code_promo, source_marketing
)
```

Extension future prévue si un vrai panier multi-articles voit le jour : table enfant `tentatives_paiement_lignes` (migration additive, pas de réécriture).

| # | Sous-étape | Statut |
|---|-----------|--------|
| 2b.1 | Migration SQL : table `tentatives_paiement` + RLS + GRANT authenticated/service_role (`supabase/phase2b_tentatives_paiement.sql`) | ✅ |
| 2b.2 | Modifier `/api/stripe/checkout/route.ts` : insérer une ligne `tentatives_paiement` (statut `creee`) juste après `stripe.checkout.sessions.create()` (l'id de session est requis pour la ligne) | ✅ |
| 2b.3 | Nouveaux hooks webhook Stripe : `checkout.session.completed` (étendu → `complete` + lien `commande_id`), `checkout.session.expired` (nouveau → `expiree`), `payment_intent.payment_failed` (nouveau → recherche de la session via `stripe.checkout.sessions.list` puis `echouee`) | ✅ |
| 2b.4 | Page Commandes fusionnée : `commandes` + `tentatives_paiement` (hors `complete`, déjà représentées par la vraie commande) dans une seule liste triée, 3 nouveaux statuts (Panier en cours / Abandonnée / Échouée), lien détail/facture désactivé pour les tentatives | ✅ |
| 2b.5 | Tests bout en bout | ✅ |
| 2b.6 | Extension aux échecs de renouvellement d'abonnement : `type` (`achat_beat`/`renouvellement_abonnement`), colonnes `abonnement_id`/`stripe_invoice_id`, CHECK de forme cohérente (`supabase/tentatives_paiement_abonnement.sql`) ; nouveau handler webhook `traiterEchecRenouvellementAbonnement` sur `invoice.payment_failed` ; affichage sur la fiche abonnement (Commandes associées + Historique) et sur la liste Commandes (libellé "Renouvellement abonnement") | ✅ |

> **Phase 2b validée le 2026-07-04** — T1 (achat réussi, non-régression), T2 (carte refusée → email/client bien résolus après correctif), T3 (panier créé immédiatement, expiration 24h fiable par construction), T4 (abonnement → aucune ligne `tentatives_paiement`, scope respecté).
>
> **Extension renouvellements validée le 2026-07-08** — échec de renouvellement forcé via Stripe test mode (facture existante payée manuellement avec la carte de déclin `4000000000000341`), tentative bien tracée et affichée (fiche abonnement + liste Commandes), récupération testée en changeant la carte par défaut de l'abonnement (pas seulement celle du client — priorité Stripe : `subscription.default_payment_method` > `customer.invoice_settings.default_payment_method`) : statut repasse à `actif`, `mois_consecutifs` incrémenté normalement (pas remis à zéro — seule une vraie annulation reset le compteur).
>
> **Débloque :** le workflow "Tentative d'achat échouée" (9e recette Phase 5) et une future automatisation "panier abandonné" peuvent maintenant être construits.
>
> **Action Jake :** exécuter `supabase/phase2b_tentatives_paiement.sql` dans l'éditeur SQL Supabase, puis ajouter les événements `checkout.session.expired` et `payment_intent.payment_failed` dans la config webhook du Dashboard Stripe (même écran que pour `account.updated` à l'étape 10).

### Phase 2c — Commerce : Panier multi-articles ✅ Validée (2026-07-09)

> **Contexte :** En concevant le token singulier/pluriel `{{le_beat}}`/`{{les beats}}` pour l'automation "Remerciement achat — 1er achat" (Phase 5), découvert que cette plateforme n'a **aucun panier multi-articles** — chaque commande = exactement 1 beat. Ce n'était planifié nulle part. Session dédiée du 2026-07-09 : lecture du contexte + du code existant, plan complet proposé et validé par Jake.
>
> **Décisions actées (2026-07-09) :**
> - **"Ajouter au panier" remplace l'achat 1-clic** — `AcheterBouton.tsx` ne redirige plus directement vers Stripe, il ajoute au panier. Plus d'achat direct en parallèle.
> - **1 panier = 1 vraie ligne `commandes`, quel que soit le nombre d'articles** (même 50 beats) — pas juste un regroupement d'affichage. `commandes` devient un **header de commande** (client, montants totaux, statut paiement), le détail par beat part dans une nouvelle table `commande_lignes`.
> - **Code promo appliqué au niveau du panier entier** (pas par article) — éligibilité vérifiée par article (comme aujourd'hui dans `LicencesTable.tsx`), mais un seul champ/un seul code par commande.
>
> **Nouveau modèle de données :**
> ```
> commandes (header)                    commande_lignes (détail)
> ├─ client_id / beatmaker_id           ├─ commande_id → commandes
> ├─ stripe_session_id (redevient       ├─ beat_id / licence_id
> │  unique — 1 session = 1 commande)   ├─ prix_paye / reduction_montant (part de l'article)
> ├─ prix_paye / reduction_montant      ├─ splits_snapshot / contrat_pdf_url
> │  (TOTAUX)                           ├─ type_transaction ('achat'/'upgrade')
> ├─ code_promo / statut / paiement     └─ ligne_originale_id → commande_lignes
> └─ (perd : beat_id, licence_id,           (remplace commande_originale_id)
>     contrat_pdf_url, commande_originale_id, type_transaction)
> ```
> `commandes.beat_id`/`licence_id` étaient déjà nullable (`sprint2_crm.sql`) — pas de blocage de contrainte. Les rows d'abonnement (`CREATION_ABONNEMENT`/`RENOUVELLEMENT`) insèrent déjà `beat_id: null` et ne sont pas concernées.
>
> **Fichiers impactés (vérifiés par grep avant validation du plan, complétés en 2c.2) :** au-delà de checkout/webhook, ce chantier touche `licence_downloads` (ajout `commande_ligne_id`), les pages téléchargement (`app/telechargement/[commandeId]/`, `lookup`, `log`), le dashboard Commandes (liste + fiche détail — table "ARTICLES" passe d'1 ligne figée à un vrai `.map()`), le CRM (`app/dashboard/business/_lib/contacts.ts` + fiche client `contacts/[id]/page.tsx` — LTV/panier moyen/licence préférée/croisement favoris-téléchargements par `beat_id`), l'espace artiste (`app/[slug]/mon-compte/achats/page.tsx`, `app/mon-compte/page.tsx` — historique d'achats), le détail code promo (`app/dashboard/business/codes-promo/[id]/page.tsx`), la RLS `split_payments` (jointure `commandes.beat_id` → `commande_lignes`, corrigée dans la migration), et **5 routes Analytics** (`overview`, `ventes`, `preferences`, `beats`, `beats/[id]`) qui joignent aujourd'hui `commandes.beat_id`/`beats(...)` directement. Le module Analytics (marqué stable) est donc rouvert par ce chantier. Non touchés (vérifiés) : `analytics/codes-promo`, `analytics/abonnements`, `listes/[id]`, `renvoyer`/`rembourser` (remboursement reste au niveau commande entière).
>
> Détail complet du raisonnement dans `memory/project_phase5_automatisations_redesign.md` (découverte initiale) et la session du 2026-07-09 (Phase 2c).

| # | Sous-étape | Statut |
|---|-----------|--------|
| 2c.1 | Session dédiée : lire le contexte + les fichiers cités, proposer un plan détaillé (schéma, flow checkout, UI panier), obtenir validation | ✅ |
| 2c.2 | Migration SQL (`supabase/phase2c_panier.sql`, fichier unique) : `commande_lignes`, `tentatives_paiement_lignes`, migration des `commandes`/`tentatives_paiement` existantes (header + 1 ligne), `licence_downloads.commande_ligne_id` (nullable), RLS `split_payments` corrigée, RLS des nouvelles tables | ✅ *(écrite — **Action Jake : exécuter `supabase/phase2c_panier.sql` dans l'éditeur SQL Supabase avant 2c.3**)* |
| 2c.3 | Checkout multi-articles : `/api/stripe/checkout` accepte `{slug, items[], code_promo?}`, boucle de pricing par article, 1 session Stripe multi-`line_items`, routing splits (session bascule en mode "fonds retenus" si ≥1 article a des splits) ; `/api/stripe/valider-code-promo` passe à `beat_ids[]` | ✅ |
| 2c.4 | Webhook `traiterPaiement` : 1 insert `commandes` (header) + N inserts `commande_lignes`, splits/contrat PDF par ligne (`distribuerSplitsArticle`), check "1er achat" évalué **une fois par session** (pas par ligne), incrément `codes_promo.utilisations` une fois par commande, token `{{le_beat}}` (renommé `{{titre_beats}}` le 2026-07-09 — cite les titres achetés plutôt que "le beat"/"les beats", voir 5.6d) recompté via `commande_lignes` | ✅ |
| 2c.5 | Téléchargements : `lookup` redevient `.maybeSingle()`, page `/telechargement/[commandeId]` liste tous les articles (1 section par beat), `log` route + `TelechargerBouton` logue le `commande_ligne_id`, `SuccessBanner` ajoutée sur la page boutique (`success_url` pointe maintenant vers `/${slug}`, plus vers un beat précis) | ✅ |
| 2c.6 | Dashboard Commandes : liste (1 ligne par commande, label "+N autres", recherche multi-beats via `tousBeatsTitres`), fiche détail (table ARTICLES en vrai `.map()`, fichiers/téléchargements par article) | ✅ |
| 2c.7 | CRM `_lib/contacts.ts` (préférences/licence via `commande_lignes`) + fiche client `contacts/[id]/page.tsx` (historique d'achats aplati par article) + `mon-compte/achats`, `mon-compte` racine, détail code promo (`codes-promo/[id]`) — tous adaptés au 1er-article + "+N autres" | ✅ |
| 2c.8 | Analytics : 5 routes adaptées pour lire via `commande_lignes` — `beats_vendus`/`ventes` comptent des articles (pas des paniers), `panier_moyen` reste au niveau commande, `top_beats`/`ca_par_beat` recalculés par ligne | ✅ |
| 2c.9 | UI Panier boutique : `CartContext` (localStorage scopé par `slug`, via `usePathname()`), `CartDrawer` (liste, suppression, code promo panier, passer commande), `CartBadge` dans `BoutiqueHeader`, `AcheterBouton` devient "Ajouter au panier", `LicencesTable` simplifié (code promo retiré — vit dans le panier maintenant), `layout.tsx` wrap `CartProvider` | ✅ |
| 2c.10 | Test bout en bout (Stripe test mode) : panier de 3 beats (1 avec split, 1 avec code promo éligible) — commande, lignes, contrats, transferts, téléchargements, dashboard, analytics, automation "1er achat" | ✅ *(T1-T23 validés — T22/T23 (automation "1er achat", titres des beats cités dans le mail) validés le 2026-07-10)* |
| 2c.11 | Bonus découvert pendant le test : panier/"Mon compte" invisibles hors de la page d'accueil boutique (vivaient dans `BoutiqueHeader`, rendu seulement sur `page.tsx`) — extrait en `BoutiqueNavBar` sticky, rendu dans `layout.tsx` donc présent sur toutes les routes `/[slug]/**` | ✅ |

### Phase 3 — Analytics ✅ Complète

Composants communs : `PeriodeSelector.tsx` · `KpiCard.tsx` · `ChartCard.tsx` · `AnalyticsLineChart.tsx` · `MiniBar.tsx`

| # | Onglet | Source SQL | Statut |
|---|--------|------------|--------|
| 3.1 | Ventes | `commandes` | ✅ |
| 3.2 | MRR/ARR (Abonnements) | `abonnements_boutique` | ✅ |
| 3.3 | Revenus | `commandes` + `abonnements_boutique` | ✅ |
| 3.4 | Préférences | `commandes → beats.styles[]` | ✅ |
| 3.5 | Codes promo | `codes_promo` + `commandes` | ✅ |
| 3.6 | Beats (+ page détail par beat) | `commandes` + `beats` + `beat_plays` | ✅ |
| 3.7 | Vue d'ensemble | Agrégation de tout | ✅ |

**Livré au-delà du périmètre initial :**
- Tracking écoutes (`beat_plays`) : seuil 30s, durée d'écoute, pays (RGPD-safe), device
- Tracking source marketing (9 sources : YouTube, Instagram, TikTok, Google, Google Ads, YouTube Ads, Newsletter, Direct, Autre) de la visite jusqu'à la commande
- Page détail beat : KPIs favoris/CA par licence/source, tables dynamiques par KPI
- Granularité adaptative des graphiques (jour/semaine/mois selon la période) + périodes semaine
- Décision **CA net = CA HT** (`brut − remises − TVA`, pas juste `brut − TVA`) appliquée uniformément sur Overview/Ventes/Revenus/Codes promo
- KPIs cliquables pilotant le graphique sur la plupart des onglets (Ventes, Revenus, Abonnements, Codes promo)

### Phase 4 — Marketing : Fondations + Campagnes 🔄 En cours

> **Contexte :** Décision prise le 2026-07-02. Fusionne le Sprint 4 du CRM (11c, jamais codé) avec les fondations nécessaires aux Automatisations (Phase 5) — les deux partagent le même socle : ciblage par segment (déjà construit), stockage de templates avec tokens, envoi Resend. La sidebar a déjà un item "Marketing" verrouillé 🔒 avec sous-items "Campagnes"/"Templates" placeholder (`Sidebar.tsx`) — cette phase les déverrouille. Construit en premier : Automatisations et Transactionnels en dépendent/en profitent ensuite.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 4.1 | Migration SQL : table `templates_email` (bibliothèque réutilisable, tokens `{{prénom}}`/`{{style_préféré}}`/`{{type_beat_préféré}}`...) + ajout colonne `contenu` sur `campagnes` (le corps du mail manque actuellement) | ✅ |
| 4.2 | Wrapper d'envoi Resend générique (`lib/mailing.ts`) : résout les destinataires d'un segment, remplace les tokens, filtre `newsletter_consent = true`, injecte le lien de désinscription | ✅ |
| 4.3 | Page `/dashboard/business/marketing/campagnes/` : liste + création (segment → template → personnalisation → envoi immédiat/planifié) | ✅ |
| 4.4 | Page `/dashboard/business/marketing/templates/` : bibliothèque de templates (créer/dupliquer/éditer), branding automatique boutique (logo, nom, lien) | ✅ |
| 4.5 | Domaine d'envoi : `[slug]@mail.myproducer.com` par défaut, option domaine propre (pro uniquement, webmails bloqués, vérification DNS) | ⏸️ *En pause — voir note ci-dessous* |
| 4.6 | Webhook Resend : désinscription → mise à jour `newsletter_consent` en BDD | ✅ |
| 4.7 | Déverrouiller "Campagnes"/"Templates" dans la sidebar (retirer le 🔒 de `Sidebar.tsx`) | ✅ |
| 4.8 | Tests bout en bout | ⏸️ *En pause — voir note ci-dessous* |

> **Note (2026-07-04, mise à jour 2026-07-16) — 4.5 et 4.8 mis en pause, pas oubliés :**
> - **4.8** sera fusionnée dans l'étape 16 (Tests & corrections, futur passage page-par-page UX/UI de tout le SaaS avant lancement) — inutile de dupliquer l'effort avec une checklist dédiée maintenant. Stopgap `campagnes@jakebmusic.com` (cf 4.3) reste actif et fonctionnel en attendant. Ne figure plus comme rang séparé dans l'ordre de priorité ci-dessus, absorbée par l'étape 16.
> - **4.5** est bloquée par une question de fond, pas de DNS : le nom **"My Producer" n'est peut-être pas définitif**. **Confirmé le 2026-07-16 : `myproducer.com` est indisponible** — ce n'est plus une hypothèse de renommage esthétique, c'est un vrai blocage. Configurer DKIM/SPF/DMARC maintenant serait du travail à refaire dès que le nom change. **Reporté à l'étape 17 (déploiement)**, coût de renommage vérifié bas par ailleurs (texte d'affichage + config uniquement, aucun impact architecture — détail dans `memory/project_naming_deferred.md`).

### Phase 5 — Marketing : Automatisations 🔄 Repensée le 2026-07-04 (pas encore codée)

> **Contexte original (2026-07-02) :** V1 = recettes prédéfinies personnalisables, déclencheur stocké en config générique (`type` + `params` JSON) pour évoluer vers un constructeur custom sans migration. Réutilise le ciblage segment + `templates_email` de Phase 4.
>
> **Refonte complète (2026-07-04) :** au lieu d'inventer des recettes abstraites, Jake a fourni ses **5 workflows réels** (texte exact) déjà utilisés sur sa propre boutique + une réflexion approfondie sur la gestion des combinaisons d'événements. Textes exacts dans `docs/automatisations/exemples-workflows.md`, détail complet des décisions dans `memory/project_phase5_automatisations_redesign.md`. **Prérequis avant de commencer : Phase 2b (Commerce — Tentatives de paiement) doit être terminée**, sinon le 9e workflow (tentative d'achat échouée) reste hors de portée.

**Méthode de construction validée par Jake (dans cet ordre) :**
1. Coder les 8 workflows ci-dessous **en isolation totale**, sans aucune logique de combinaison
2. Puis lister les combinaisons réalistes entre workflows (plusieurs déclencheurs le même jour, même client) et décider quoi faire pour chacune
3. Enfin, brancher un système IA — **uniquement** pour les combinaisons vraiment rares/anecdotiques (pas pour l'ensemble des emails)

**Les 8 workflows (V1 "seuls", avant combinaisons) :**

| # | Workflow | Détail | Statut |
|---|---|---|---|
| 5.6a | Bienvenue abonnement | Nouvel abonnement — texte réel fourni par Jake | ✅ *(validé le 2026-07-04)* |
| 5.6b | Abonnement en attente | Échec de renouvellement (pas annulation) — `{{mois_avant_cadeau}}`. Statut `impaye` désormais distingué de `annule` dans le webhook ; délai de grâce d'1 mois avant annulation automatique (`/api/cron/abonnements-impayes`) ; récurrence du beat cadeau configurable par le beatmaker (`abo_recurrence_cadeau_mois`, page `/dashboard/business/plans`) au lieu d'un "4 mois" fixe ; `mois_consecutifs` enfin réellement incrémenté/remis à zéro | ✅ *(validé le 2026-07-08, T1-T7)* |
| 5.6c | Churn message perso | Annulation réelle — distinct de la confirmation robotique d'annulation (Phase 6 Transactionnels). Déclenché à la décision d'annuler (`cancel_at_period_end`), pas à la fin réelle de période — voir note ci-dessous | ✅ *(validé le 2026-07-09, envoi + réception confirmés)* |
| 5.6d | Remerciement achat | 4 recettes indépendantes : **1er achat**, **2e**, **3e achat**, **4e achat et +** (textes finalisés par Jake — le 4e+ pensé pour rester sincère répété à l'identique de la 4e à la 10e+ commande, confirmé au 5e achat test). Token `{{titre_beats}}` sur les 4 : cite les titres achetés (1-3 noms) ou "les N beats" au-delà. Webhook choisit la recette selon le nombre total de commandes LICENCE du client chez ce beatmaker | ✅ *(les 4 paliers validés le 2026-07-14, y compris le redéclenchement du 4e+ à la 5e commande)* |
| 5.6e | Bienvenue perso | Codé le 2026-07-10 : hook dans `lierCompteClient` (inscription **et** connexion — 1re fois que ce client est connu de CE beatmaker). La règle de suppression prévue à l'origine (rien d'autre le même jour) a été **retirée le 2026-07-14** — c'est de la logique de combinaison entre workflows, reportée volontairement en Phase 5.7 (voir note) | ✅ *(validé le 2026-07-14 : cas inscription + cas connexion sur compte existant)* |
| 5.6f | Relance inactivité | X mois sans achat, configurable par le beatmaker (`config.mois_inactivite`, défaut 3). N'existe pas chez Jake, construit de zéro : scan cron (pas de déclencheur ponctuel), `reference_id` = dernière commande LICENCE du client, se redéclenche naturellement après un nouvel achat suivi d'une nouvelle inactivité. **Ajout 2026-07-10 :** code promo personnel généré automatiquement à l'envoi (`code_promo`, `pourcentage_remise` — 2e paramètre configurable, défaut 50%, `date_expiration_code` — 30 jours), réservé à l'email du client, usage unique — voir note ci-dessous | ✅ *(validé le 2026-07-14 : scan → événement → email avec vrai code → réduction appliquée au checkout, 2 bugs Commerce trouvés et corrigés au passage, voir note)* |
| 5.6g | Follow-up free download | Tracking existant (`free_downloads`) — hook direct dans `/api/free-download`. Texte rédigé par Claude (pas de référence Jake), finalisé par Jake. Le garde-fou anti-achat prévu à l'origine a été **retiré le 2026-07-14** (même décision que 5.6e — voir note 5.7) | ✅ *(validé le 2026-07-14 : cas simple uniquement, la suppression n'est plus dans le scope de cette phase)* |
| 5.6h | Follow-up favori | **Annulé (2026-07-10)** — Jake juge qu'un like sur un beat n'est pas un signal d'intention d'achat comme un téléchargement gratuit ou un achat, et que relancer sur cette base peut donner une impression de flicage. Code retiré (type, recette, garde-fou, scan cron) | ❌ *(annulé, retiré du code)* |

> 9e workflow **en attente** : Tentative d'achat échouée — bloqué tant que la Phase 2b (Commerce) n'est pas terminée.
>
> Tous les emails envoyés en **J+1** (jamais le jour même) — choix délibéré de Jake pour ne jamais sonner robotique.

**Décisions d'architecture actées :**
- Éditeur de contenu : **simple** (objet + corps en `ChampAvecVariables`), pas le `BlocEditor` complet — un message perso n'a pas besoin de sections beats/CTA/promo.
- Ciblage : **paramètre simple** par recette (ex. nombre de mois), pas de constructeur ET/OU façon Segments pour cette V1.
- `config jsonb` générique dès 5.1 (permet d'évoluer vers un vrai constructeur custom plus tard sans migration). Un vrai workflow multi-étapes nécessiterait une table additionnelle plus tard (`automatisation_etapes`) — migration additive, pas une réécriture.
- Pas de constructeur de workflow libre pour les beatmakers en V1 — ils configurent 8 recettes fixes, ils n'en créent pas.

**Gestion des combinaisons — revue exhaustive faite et codée le 2026-07-14 (remplace le cadrage original ci-dessous, conservé pour mémoire) :**

Détail complet des 21 scénarios (toutes les paires possibles entre les 7 signaux) passés en revue un par un avec Jake, avec le raisonnement pour chacun : `docs/automatisations/combinaisons-5.7.md`. Résumé :
- Système à **2 passes**, jamais plus d'1 email par client par jour : passe 1 (l'argent d'abord — résoudre la famille Abonnement toute seule en un état net, PUIS la combiner avec l'achat du jour) fait taire tout le reste si elle donne un résultat ; passe 2 (seulement si la passe 1 ne donne rien) — Relance > Free download > Bienvenue perso.
- **Une seule vraie combo codée en dur** au final : Achat + Bienvenue abo, déclinée en **2 variantes** selon le palier réel de l'achat (`combo_1er_achat_bienvenue_abo` — ton "nouvel artiste" — et `combo_achat_recurrent_bienvenue_abo` — ton "habitué", décision du 2026-07-15, le côté abonnement est toujours "bienvenue" par construction). Toutes les autres combinaisons envisagées à l'origine (Achat+Abonnement en attente, notamment) ont été révisées en cours de revue vers une simple priorité/domination plutôt qu'un template fusionné.
- **Aucun cas rare** : la voie IA (5.8) n'a rien à traiter avec les 7 workflows actuels — **non construite**, filet de sécurité minimal à la place (silence + log si un futur signal ne rentre dans aucune des 3 familles).
- 2 correctifs de logique de base découverts en chemin (pas des combinaisons) : Relance inactivité doit compter les mensualités d'abonnement payées comme activité, pas seulement les commandes licence ; le garde-fou `achete` de Follow-up free download n'était jamais écrit nulle part dans le code.
- Backlog noté pendant la revue, pas construit : mail de fidélité pour un abonné actif sans achat licence ; fiche explicative pédagogique pour les beatmakers sur la logique de combinaison (à écrire après test, une fois le comportement final figé).

<details>
<summary>Cadrage original du 2026-07-04 (remplacé par la revue ci-dessus, conservé pour l'historique)</summary>

- Regrouper en "slots" mutuellement exclusifs : Abonnement (bienvenue/en attente/churn — un seul état net), Achat (1 seul palier actif), Bienvenue perso (exclusif), Relance inactivité (toujours seul).
- État net pour événements contradictoires : abonnement créé + annulé le même jour → s'annule, silence total sur l'abonnement ce jour-là.
- Combos fréquentes/prévisibles → **template combiné codé en dur, pas d'IA** : Achat+Abonnement bienvenue (cas prioritaire pour Jake), Achat+Abonnement en attente, Achat+Tentative échouée, Achat+Abonnement+Tentative échouée (Jake a déjà écrit un exemple réel combinant les 3, cf exemple "Kaaris" dans la mémoire).
- Combos rares/anecdotiques (ex. Achat+Churn le même jour) → **IA + validation humaine** : le cron détecte la combinaison, génère un brouillon (à partir des textes de Jake comme référence de ton), notifie (email + badge dashboard business, notif mobile plus tard), Jake édite/valide avant envoi. Pas de péremption : le texte est re-rendu à chaque ouverture pour adapter la référence temporelle ("hier"/"lundi"/"il y a quelques jours") à la date réelle de validation.
- Raison du choix hybride : fiabilité (rien ne part sans relecture humaine sur l'imprévisible) + coût (l'IA ne tourne que sur des cas rares dans de petites boutiques) — un tout-IA automatique aurait été risqué (pas de relecture avant envoi) et coûteux en continu.

</details>

| # | Sous-étape | Statut |
|---|-----------|--------|
| 5.1 | Migration SQL (`supabase/phase5_automatisations.sql`) : `automatisations` (config par recette), `automatisation_evenements` (file d'attente déposée par les webhooks), `automatisation_envois` (log idempotent) + RLS | ✅ |
| 5.2 | Les workflows en isolation (contenu + déclencheur) — **construits un par un** : 7 workflows retenus (Follow-up favori annulé le 2026-07-10, voir 5.6h). **Les 7 sont validés en test réel** (2026-07-14) : Bienvenue abonnement, Abonnement en attente, Churn message perso, Remerciement achat (4 paliers), Relance inactivité, Bienvenue perso, Follow-up free download | ✅ |
| 5.3 | Cron quotidien `/api/cron/automatisations` (pattern `splits-expiration`) : scan `automatisation_evenements` non traités, échéance calculée par événement | ✅ *(pilote)* |
| 5.4 | Hooks événementiels : `abonnement/succes/route.ts` résout/crée le client puis dépose l'événement `bienvenue_abonnement` | ✅ *(pilote — 1/6 événements)* |
| 5.5 | Page `/dashboard/business/marketing/automatisations/` : éditeur simple (objet/corps + palette de variables), toggle actif, **file d'attente** (événements en attente + bouton "Exécuter maintenant") — structure prête à accueillir les 7 autres recettes. Complétée le 2026-07-10 : bouton **Visualiser** (aperçu sujet/corps avec tokens résolus, sans envoyer), bouton **Supprimer** (retire un événement de la file, avec confirmation), et l'échec de sauvegarde d'une recette (ex. migration SQL pas encore exécutée pour un nouveau type) remonte maintenant un message d'erreur au lieu d'échouer en silence | ✅ *(pilote, validé — email reçu après exécution manuelle le 2026-07-04)* |
| 5.6 | Rédaction des textes manquants (free download, favori) | 🔄 *(rédigés par Claude faute de référence Jake, à valider/ajuster au test)* |
| 5.7 | Combinaisons : revue exhaustive des 21 scénarios + implémentation (voir section dédiée ci-dessus et `docs/automatisations/combinaisons-5.7.md`) — `lib/automatisations.ts` restructuré en résolution par jour/client (2 passes), combo codée en dur en 2 variantes selon le palier d'achat (`combo_1er_achat_bienvenue_abo` / `combo_achat_recurrent_bienvenue_abo`, migration `supabase/phase5_combinaisons.sql`), correctifs Relance inactivité (mensualités = activité) et garde-fou `achete` (écrit dans le webhook), cron `/api/cron/automatisations` regroupe par jour avant résolution | 🔄 *(codé le 2026-07-14/15, build+lint propres, **non testé en conditions réelles**)* |
| 5.8 | Système IA + validation humaine pour combinaisons rares | ❌ *(non construit — aucun cas rare identifié pendant la revue 5.7, voir note ci-dessus)* |
| 5.9 | Tests bout en bout de 5.7 — checklist complète des 17 tests dans `docs/automatisations/combinaisons-5.7.md` (section "Tests 5.9") | 🔄 *(1/17 validé — Test 1, combo achat+bienvenue abo, le 2026-07-15 ; Test 10 interrompu par le bug de connexion auto, à refaire)* |

> **Mécanique de planification (2026-07-04) :** reprend le système réel de la boutique perso de Jake (AutomateWoo), pas un simple délai fixe — chaque recette a un `delai_heures` (attente minimum) + une `heure_cible_minutes` optionnelle (heure de Paris, ex. 10h15) : l'envoi part à la prochaine occurrence de cette heure après le délai, jamais à l'heure exacte de l'événement (un achat à 3h55 ne génère jamais un mail à 3h55 le lendemain). Heure cible désactivée = mode test, envoi dès le délai passé.
>
> **Limite Vercel Hobby découverte en testant :** les cron jobs ne tournent qu'une fois par jour sur ce plan (±1h de précision) — pas de vérification "toutes les 2 minutes" comme sur AutomateWoo tant que le passage à Vercel Pro (déjà prévu avant lancement) n'est pas fait. En attendant, le bouton "Exécuter maintenant" de la file d'attente permet de tester/débloquer un envoi à tout moment.
>
> **Limitation connue du pilote :** `lib/automatisations.ts` construit un destinataire minimal (identité + boutique) sans les statistiques CRM (LTV, RFM, préférences) — celles-ci exigent une session utilisateur (`chargerContactsEnrichis`), indisponible en contexte cron/webhook (service_role). Suffisant pour les textes de Jake, qui ne référencent que l'identité. À enrichir si un futur workflow a besoin de plus (ex. `{{nb_achats}}`).
>
> **✅ Point de vigilance scaling — corrigé le 2026-07-04 :** `/api/cron/automatisations` traitait les événements séquentiellement (un par un), avec un risque de dépasser le temps d'exécution max si beaucoup de boutiques partagent la même heure cible. Corrigé : traitement par lots de 20 en parallèle (`Promise.all`) + plafond de 500 événements par passage (le surplus attend simplement le passage suivant, rien n'est perdu). Reste en réserve si le besoin se confirme un jour à très grande échelle : décalage d'heure cible par boutique (jitter), ou passage à un système de réveil individuel par événement (ex. Vercel Workflows) plutôt qu'une ronde périodique partagée.
>
> **Limite connue (5.6b) :** `automatisation_evenements` a une contrainte `UNIQUE (type, reference_id)`. Pour `abonnement_en_attente`, `reference_id` = l'id de l'abonnement — donc si un même abonnement retombe en impayé une 2e fois après s'être rétabli entre-temps, l'insert échoue (erreur loguée dans `[webhook] Erreur insert automatisation_evenements`, pas de crash) et l'email n'est pas renvoyé pour ce 2e épisode. Edge case jugé rare, non traité pour l'instant plutôt que de complexifier le modèle de référence — à corriger si ça se présente en pratique (ex. générer un id de référence par épisode plutôt que par abonnement).
>
> **5.6c — décision de point de déclenchement (2026-07-09) :** Jake veut le message envoyé dès que l'abonné **décide** d'annuler (clic "Annuler" côté Business ou self-service client, `cancel_at_period_end=true`), pas à la fin réelle de la période payée — sinon l'envoi peut être décalé de plusieurs semaines. Déclenché dans `traiterMajAbonnement` (`customer.subscription.updated`) sans détection de transition (le bouton Business pose `annulation_en_cours=true` en base de façon synchrone, avant l'arrivée du webhook — une détection par transition ne verrait jamais passer ce cas) ; la contrainte `UNIQUE(type, reference_id)` absorbe les tentatives redondantes. `traiterAnnulationAbonnement` (`customer.subscription.deleted`) reste en filet pour les annulations immédiates (ex. abo impayé annulé directement, sans phase `cancel_at_period_end`).
>
> **Feature bonus découverte en testant (2026-07-09) :** ajout d'un bouton "Définir principal" sur la fiche client (`emails_secondaires` / emails de fusion) pour permuter l'email d'envoi — nécessaire pour tester avec une vraie boîte de réception. **Trou identifié en creusant (mineur, non corrigé) :** la résolution de compte à l'inscription (`lib/lier-compte-client.ts`) et la détection de doublons (`comparerPaire` dans `app/dashboard/business/doublons/page.tsx`) ne regardent jamais `emails_secondaires` — seulement `clients.email`. Si quelqu'un se réinscrit avec un ancien email relégué en secondaire, ça reste rattrapable par similarité de nom/téléphone (signaux indépendants de l'email dans `comparerPaire`), donc rarement invisible en pratique — seul le cas nom+téléphone tous deux non-matchants passerait inaperçu.
>
> **5.6d — scission en 2 automations + décision panier (2026-07-09) :** en concevant le token singulier/pluriel ({{le_beat}} vs {{les beats}}) demandé par Jake, on a découvert que cette plateforme n'a **aucun panier multi-articles** (chaque commande = 1 beat, contrairement à la boutique perso de Jake) — construire un vrai panier n'était planifié nulle part (juste une clause de compatibilité future dans la conception de la Phase 2b, jamais daté). Décision : ne pas construire le panier maintenant, rendre le token déjà compatible avec un futur panier sans le construire. `{{le_beat}}` compte les lignes `commandes` partageant le même `stripe_session_id` — toujours 1 aujourd'hui, automatiquement correct si un panier existe un jour (un panier créerait plusieurs lignes sous la même session). Seul ajustement prévu ce jour-là : évaluer "1er achat" une fois par session plutôt qu'une fois par ligne (sinon l'automation se déclencherait plusieurs fois pour une même commande groupée). **Décision actée pour plus tard :** un panier de 3 beats comptera comme **1 seule commande** (pas 3 achats) pour les paliers du futur workflow "client récurrent". En conséquence, **5.6d est scindé en 2 automations** : "Remerciement achat — 1er achat" (codé, binaire 0 vs 1+ achat, indépendant du panier) et "paliers client récurrent" (2e/3e/4e+, reporté à une session dédiée où Jake rédigera les textes).
>
> **Textes 3e/4e+ finalisés par Jake (2026-07-10) :** 3e achat insiste sur la fidélité ("tu fais clairement partie des habitués") plutôt que de redemander un retour déjà sollicité au 1er achat. 4e achat et + est volontairement sobre ("toujours un plaisir de te voir revenir") car ce texte se répète à l'identique de la 4e à la 10e+ commande d'un même client fidèle — un ton trop appuyé ("ça me touche vraiment") perdrait sa sincérité répété tel quel.
>
> **Les workflows restants codés le 2026-07-10 (Jake ne pouvait pas tester dans l'immédiat, a demandé de tout coder d'un coup) :**
> - **Bienvenue perso** : hook dans `lierCompteClient()` (`lib/lier-compte-client.ts`), au moment où un lead est créé pour un beatmaker (inscription **ou** connexion — un compte existant se connectant pour la 1re fois sur une nouvelle boutique compte comme "nouveau" pour ce beatmaker). Règle de suppression ("rien d'autre le même jour") vérifiée à l'envoi (J+1) via `doitEtreIgnore()`, pas au dépôt de l'événement — sinon impossible de savoir si un achat va arriver plus tard dans la journée.
> - **Relance inactivité** : nouveau cron dédié `/api/cron/scans-automatisations` (pas de déclencheur ponctuel, c'est un état pas un événement) : dernière commande LICENCE par client, relance si plus vieille que le seuil configuré. `reference_id` = cette dernière commande, donc un nouvel achat suivi d'une nouvelle inactivité redéclenche naturellement (nouvelle commande = nouveau `reference_id`).
> - **Follow-up free download** : hook direct dans `/api/free-download/route.ts` (route serveur existante). Sauté à l'envoi si `free_downloads.achete` est passé à `true` entre-temps. **Aucun texte de référence de Jake** (contrairement aux 6 autres workflows) — rédigé par Claude dans le ton observé sur les autres textes, puis retravaillé et validé par Jake.
> - **Follow-up favori codé puis annulé le même jour** (voir 5.6h) — Jake a jugé qu'un like n'est pas un signal d'intention d'achat comme un téléchargement gratuit ou un achat, et que relancer dessus peut donner une impression de flicage. Code entièrement retiré (type, recette, garde-fou, scan dédié) ; le cron `/api/cron/scans-automatisations` ne scanne plus que Relance inactivité (nom générique conservé, prêt pour un futur workflow du même genre).
> - **`automatisationActive()` factorisée** dans `lib/automatisations.ts` (était dupliquée dans le webhook Stripe) — maintenant appelée aussi par `lierCompteClient` et `/api/free-download`.
>
> **5.6f — code promo personnel dans Relance inactivité (2026-07-10) :** Jake veut un vrai levier de conversion, pas juste un message ("j'ai pensé à te faire un petit cadeau... -{{pourcentage_remise}} % avec le code {{code_promo}}"), ton toujours amical, pas commercial/agressif. Le code est créé dans `codes_promo` **uniquement à l'envoi réel** (pas à la prévisualisation, pour ne pas générer de codes fantômes à chaque clic sur "Visualiser") : `type_remise: 'panier'`, `emails_autorises: [email du client]` (personnel, pas partageable), `limite_par_utilisateur: 1` (usage unique). Pas d'appel Stripe (Coupon/PromotionCode) — comme tous les codes `panier`/`produit` existants, la réduction est calculée côté serveur au checkout, jamais transmise à Stripe. **3 paramètres configurables** (`champsConfig`, plus seulement `champConfig` — `RecetteCard` gère maintenant un tableau de champs numériques) : mois d'inactivité, pourcentage de remise, et jours de validité du code (défaut 30 — décision Jake : crée un peu d'urgence, date affichée en toutes lettres via `{{date_expiration_code}}`).
>
> **2 bugs Commerce trouvés en testant le code promo réel (2026-07-10), corrigés :**
> 1. `/api/stripe/valider-code-promo` ne vérifiait `emails_autorises` que si un email était fourni, et le panier (`CartDrawer.tsx`) n'envoyait jamais l'email à cette étape — un code personnel s'affichait donc "appliqué" avec la réduction dans le panier même sans email connu, alors qu'il était bien rebloqué (fail closed correctement) au moment réel du paiement. Trompeur, pas une faille (le paiement final était déjà protégé). Corrigé : le serveur renvoie `valide: false` avec un message clair tant que l'email n'est pas fourni pour un code à `emails_autorises`, et le panier transmet l'email dès qu'il est saisi.
> 2. `checkout/route.ts` excluait les licences `illimité`/`exclusive` de **toute** réduction (`estIllimite`), y compris les codes promo — alors que cette exclusion ne devait viser que la remise abonné automatique (décision produit d'origine). Un code promo reste un choix explicite du beatmaker par code (via `licences_eligibles`), pas une exclusion globale non configurable. Corrigé : la remise abonné continue d'exclure illimité/exclusive, les codes promo ne l'excluent plus.

### Phase 6 — Mailing : Transactionnels ✅ Validé (6.1-6.6 + 6.8-6.9), reste 6.7

> **Contexte :** Décisions prises le 2026-07-02. Comble un vrai trou produit — aujourd'hui **aucun** email de confirmation n'est envoyé après un achat ou un abonnement (seuls les emails de splits/collab existent dans `lib/emails.ts`). Indépendant du socle Marketing (pas de ciblage segment) mais peut réutiliser le wrapper d'envoi Resend de la Phase 4.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 6.1 | Migration SQL : table `templates_transactionnels` (beatmaker_id, type, titre, intro) + colonnes branding sur `beatmakers` (`couleur_marque`, `signature_transactionnels`, `titre_footer_reseaux`, `footer_message_reseaux`) + RLS + GRANT | ✅ |
| 6.2 | `lib/emails.ts` : `confirmationCommande`, `confirmationAbonnement`, `confirmationDemandeAnnulation`, `annulationAbonnement` (branding dynamique + fallback défaut) | ✅ |
| 6.3 | Hooks webhook Stripe : envoi à `checkout.session.completed` (commande + abonnement), `customer.subscription.updated` (demande d'annulation) et `customer.subscription.deleted` (filet fin d'abonnement) | ✅ |
| 6.4 | Page `/dashboard/business/mailing/transactionnels/` : accordéon (une section ouverte à la fois) avec aperçu en direct (anti-rafale 400ms), branding partagé (couleur, signature dédiée, footer réseaux avec titre+phrase) + titre et intro personnalisables par type | ✅ |
| 6.5 | Nouvel onglet sidebar "Mailing" (sous-section Transactionnels) | ✅ |
| 6.6 | Tests bout en bout | ✅ |
| 6.7 | **Beat cadeau de fidélité** (5e type transactionnel, trou de scope découvert le 2026-07-08) — voir note ci-dessous | ⬜ *(reporté à une session dédiée, 2026-07-17)* |
| 6.8 | **Email officiel de confirmation de création de compte** — nouveau type `confirmation_compte_artiste`, envoyé dans `/auth/callback` après confirmation d'inscription artiste, brandé à la boutique de départ (slug résolu depuis `?redirect=` imbriqué dans `next`) | ✅ *(testé 2026-07-17)* |
| 6.9 | **Personnalisation du mail free download** — nouveau type `telechargement_gratuit`, remplace le HTML codé en dur de `/api/free-download/route.ts` | ✅ *(testé 2026-07-17)* |

> **Bilan complet (2026-07-17) :** périmètre élargi par rapport au plan d'origine du 2026-07-02, en 4 vagues dans la même session — (1) 6.1-6.6 avec un 4e type temps réel `demande_annulation_abonnement` ajouté en cours de route (le plan initial ne notifiait le client qu'à la fin RÉELLE de la période, sans confirmation immédiate ni date de fin d'accès — retour Jake en testant) ; (2) 6.8/6.9, deux trous de scope découverts en fin de session (confirmation de compte artiste, personnalisation free download) ; (3) réglages étendus (titre par email, signature dédiée aux transactionnels, footer réseaux avec titre+phrase personnalisables) puis repassés en accordéon (6 types = trop dense en vue à plat) ; (4) fix de l'expéditeur, resté "My Producer" générique au lieu du nom de boutique jusqu'à ce que Jake le remonte.
>
> **Décisions structurantes à retenir :**
> - **Signature dédiée aux transactionnels** (`beatmakers.signature_transactionnels`), séparée de `signature_emails` (Automatisations/Campagnes) — Jake signe différemment selon le canal ("Jake" en automatisation, plus personnel, "Jake B" en transactionnel, plus officiel).
> - **Compte artiste = global, pas par boutique** : `confirmation_compte_artiste` est brandé à la boutique de départ (celle depuis laquelle l'inscription a eu lieu) plutôt qu'un générique "My Producer" séparé — envoyer les deux aurait fait doublon pour une seule action. Si aucune boutique de départ n'est identifiable, aucun email n'est envoyé (pas de repli générique).
> - **Expéditeur** : tous les emails transactionnels partent maintenant en `${nom_artiste} <campagnes@jakebmusic.com>`, aligné sur le pattern déjà utilisé par Campagnes/Automatisations (`lib/automatisations.ts`, `lib/mailing.ts`) — un vrai domaine par boutique reste bloqué par la question du nom (Phase 4.5).
> - **Icônes réseaux sociaux dans les emails** : ni le SVG inline ni les images en `data:` URI base64 ne s'affichent dans Gmail (et la plupart des clients mail) — les deux sont strippés par sécurité côté réception, contrairement à l'aperçu qui passe par un vrai navigateur. Seule une vraie image hébergée fonctionne de façon fiable : icônes statiques dans `public/icons/*.png` (générées une fois via `sharp`), servies directement par Vercel.
>
> **11 bugs trouvés et corrigés pendant les tests**, dont un vrai bug de fiabilité qui a pris plusieurs cycles à isoler : `demande_annulation_abonnement` ne s'envoyait jamais, sans aucune erreur ni log. Deux causes empilées — (1) `subscription.cancel_at_period_end=true` ne remplit **pas** `subscription.cancel_at` côté Stripe (mécanismes séparés, confirmé par la doc), donc le garde-fou sur ce champ bloquait silencieusement l'envoi ; corrigé en lisant `subscription.items.data[0].current_period_end`. (2) Cause racine réelle : l'envoi était en fire-and-forget (`.catch()` sans `await`) en toute dernière instruction de sa fonction, sans rien après pour laisser à la promesse (appel Resend + écriture `email_logs`) le temps de finir avant que Vercel ne gèle l'instance serverless à la réponse du webhook — silence total garanti. Les 3 autres emails transactionnels avaient plus de travail asynchrone après leur appel, masquant le même risque par chance de timing ; **tous** les envois d'emails dans le webhook et `/auth/callback` sont maintenant `await`és systématiquement, leçon appliquée d'emblée aux nouveaux points d'accroche (6.8/6.9). Autres bugs : montant abonnement affiché en centimes au lieu d'euros, largeur d'email trop étroite sur Gmail desktop (600px), page `/artiste/mot-de-passe-oublie` manquante (404), contexte boutique perdu dans la chaîne connexion→mot de passe oublié, lien de reset cassé par un double `?` (Supabase colle `?token_hash=...` à la fin du `redirectTo` sans vérifier s'il contient déjà un `?` — contexte boutique déplacé en paramètre de chemin), build Vercel cassé (`lib/stripe.ts` instanciait le client Stripe au chargement du module), erreurs Stripe non catchées sur annuler/reprendre (message trompeur "Impossible de joindre le serveur"), filet `annulation_abonnement` qui s'envoyait sans condition (doublon avec la demande d'annulation), icônes réseaux invisibles en réception (SVG puis data URI, tous deux strippés par Gmail).

> **Trou de scope découvert le 2026-07-08 :** en testant "Abonnement en attente" (Phase 5), Jake a réalisé que `mois_consecutifs` (compteur de fidélité, incrémenté à chaque renouvellement réussi) n'a jamais eu de contrepartie codée — le compteur alimente uniquement le token `{{mois_avant_cadeau}}` de l'email, mais **rien ne délivre réellement le cadeau** quand le seuil (`abo_recurrence_cadeau_mois`, configurable par le beatmaker) est atteint. Vérifié : ce n'était planifié nulle part (ni étape 8, ni les 8 workflows de la Phase 5, ni les types déjà listés ici).
>
> **Décision de classification (Jake) :** ce n'est **pas** une Automatisation Marketing (opt-in, texte de persuasion, toggle séparé à activer) mais un **email transactionnel** — la remise du cadeau doit être une conséquence mécanique automatique de la configuration du plan d'abonnement (si le beatmaker a un abonnement actif avec une récurrence de N mois configurée, le client doit recevoir son cadeau tous les N mois, sans dépendre d'un toggle marketing distinct). D'où le rattachement à la Phase 6 plutôt qu'un 9e workflow Phase 5.
>
> **Conception validée (à coder à la Phase 6) :**
> - Déclenchement dans `traiterPaiementAbonnement` (webhook), juste après l'incrément de `mois_consecutifs` : si le nouveau total est multiple de `abo_recurrence_cadeau_mois`.
> - Génération automatique d'un code promo (`codes_promo`) : 100% de réduction, `type_remise='produit'`, sans restriction de beat/licence (utilisable sur tout le catalogue), `limite_par_code=1` + `limite_par_utilisateur=1` + `emails_autorises=[email du client]` (réservé à ce client, un seul usage). Visible tel quel dans la page Codes promo existante.
> - Reste à trancher à ce moment-là : expiration du code (jamais vs durée limitée) et texte exact de l'email (pas de texte de référence existant chez Jake pour ce cas précis, contrairement aux 8 workflows de la Phase 5).

### Phase 7 — Catégories & Certification ✅ Validé de bout en bout (2026-07-20), checklist T0-T19 à 100%

> **Contexte :** Décisions prises le 2026-07-02. Les 4 listes (`STYLES_OPTIONS`, `AMBIANCES_OPTIONS`, `INSTRUMENTS_OPTIONS`, `TYPE_BEAT_OPTIONS`) étaient hardcodées dans `BeatForm.tsx`, stockées en `text[]` libre sur `beats` (colonne inchangée — seule la SOURCE des options change). Ambiances/Instruments fixés par la plateforme (lecture seule) ; Styles/Type beat en mode hybride (ajout libre par beatmaker, visible seulement par lui, avec certification plateforme optionnelle qui rend la catégorie globale et non modifiable). La modération est absorbée par l'étape 15 (Admin).

| # | Sous-étape | Statut |
|---|-----------|--------|
| 7.1 | Migration SQL : table `categories` (type, nom, source plateforme/beatmaker, beatmaker_id nullable, statut) + seed des 4 listes hardcodées en `source=plateforme` + RLS/GRANT — `supabase/phase7_categories.sql` | ✅ |
| 7.2 | Rebrancher `BeatForm.tsx` sur la table `categories` — `lib/categories.ts` (chargement + synchronisation) | ✅ |
| 7.3 | Ambiances/Instruments : lecture seule (source=plateforme uniquement) | ✅ |
| 7.4 | Styles/Type beat : ajout libre par beatmaker → insert `categories` en `source=beatmaker`, visible uniquement par lui | ✅ |
| 7.5 | Bouton "Demander la certification" → demande dans une table dédiée (voir 7.9) | ✅ |
| 7.6 | Modération (Admin) : approuver/rejeter → une fois certifiée, catégorie globale + non modifiable | ✅ |
| 7.7 | Page `/dashboard/business/categories/` : 4 onglets, vraie table de gestion (stats + édition) | ✅ |
| 7.8 | Images de catégories (officielle admin + perso + override par boutique) — *bonus non planifié, différent du "dashboard tendances" ci-dessous* | ✅ |
| 7.9 | Demandes de certification dans une vraie table dédiée `demandes_certification` (historique conservé) | ✅ |
| 7.10 | Regroupement des demandes par nom (casse ignorée strictement) + fusion atomique set-based | ✅ |
| 7.11 | Dashboard tendances *(V2, après volume de données suffisant)* : agrégation commandes × catégories certifiées | ⬜ *(V2, volontairement pas construit — les stats CA/ventes/écoutes par catégorie existent déjà dans les vues admin/business, seule une page dédiée "tendances" reste à faire)* |

> **Implémentation initiale (2026-07-17) :** `lib/categories.ts` centralise le chargement des options (`chargerOptionsCategories`) et la synchronisation des ajouts libres (`synchroniserCategoriesPersonnalisees`, appelée dans `/api/beats/creer` et `/api/beats/[id]/modifier`). Deux index uniques séparés sur `categories` (partiel pour les lignes plateforme, plein pour les lignes beatmaker). RLS interdit à un beatmaker de passer sa propre catégorie à `certifiee` — seule la modération (service_role) le peut. `lib/admin.ts` (`estAdmin()`, gate par **slug de boutique** `jakeb-test`) + `/dashboard/admin/categories/` créés en cours de session (trou de scope remonté par Jake : aucun moyen de gérer les catégories officielles sans SQL).
>
> **Session de tests + extensions (2026-07-20), tout construit au fil des tests avec Jake :**
> - **Bug corrigé** : `synchroniserCategoriesPersonnalisees` enregistrait en "perso" TOUS les styles sélectionnés sur un beat, y compris ceux déjà `source=plateforme` ou `statut=certifiee` — sélectionner un style déjà officiel suffisait à créer une fausse catégorie perso en doublon. Filtre désormais sur les noms déjà officiels avant l'upsert.
> - **BeatForm repensé** (`app/dashboard/business/beats/_components/BeatForm.tsx`) : onglets par type (Styles/Ambiances/Instruments/Type Beat) au lieu d'un flux vertical unique, combobox avec recherche + dropdown (au lieu de pastilles toutes affichées — anticipe la croissance du catalogue certifié), badge "certifié" façon réseaux sociaux (rond bleu + coche) sur les tags certifiés.
> - **Images de catégories** (7.8) : `categories.image_url` (image officielle admin ou perso directe), nouvelle table `categories_images_boutique` (override par boutique d'une image officielle/certifiée, pour respecter le branding de chaque boutique), route `/api/upload/categorie-image` (même pattern sharp→webp→R2 que les covers de beats). Pour l'instant proposé uniquement sur Type Beat (photo d'artiste) — facile à ouvrir aux autres types plus tard.
> - **Renommage d'une catégorie perso** : `nom` est aussi la clé de matching littérale stockée dans `beats.styles`/`type_beat` (pas un id) — un renommage qui ne toucherait que la ligne `categories` casserait le lien avec les beats déjà tagués. Fonction Postgres atomique `renommer_categorie_perso()` (même pattern que `fusionner_compte_client.sql`) : vérifie propriété + non-certification, renomme la catégorie ET cascade sur les beats du même beatmaker en une seule transaction.
> - **Demandes de certification extraites vers une table dédiée** (7.9, `demandes_certification`) : `categories.statut='en_attente_certification'` perdait toute trace d'un rejet (le statut revenait juste à `active`). Désormais `categories.statut` se limite à `active`/`certifiee`, le workflow de demande (avec historique approuvée/rejetée) vit dans sa propre table.
> - **Regroupement des demandes par nom** (7.10, le plus gros chantier de la session) : plusieurs beatmakers peuvent créer indépendamment une catégorie perso avec le même nom (à la casse près — "Jerk"/"JERK"/"jerk" sont regroupées, "Jerk"/"Jerks" non). `demandes_certification` gagne `nom`/`type` dénormalisés (l'historique ne dépend plus de l'existence de la catégorie d'origine) et `categorie_id` passe en `ON DELETE SET NULL` (⚠️ bug de migration corrigé en session : la colonne était restée `NOT NULL`, incompatible avec `SET NULL` — `supabase/phase7_11_fix_categorie_id_nullable.sql`). Fonction `traiter_groupe_certification()` entièrement set-based (boucle uniquement sur le nombre de variantes de casse distinctes, jamais sur le nombre de lignes — reste rapide même à grande échelle) : approuver renomme les beats des variantes vers le nom final choisi par l'admin, supprime les doublons perso (demandeurs et non-demandeurs confondus — la fusion matche par nom, pas par "a demandé ou non"), marque toutes les demandes du groupe approuvées. Email générique (`envoyerCategorieCertifiee`, même pattern que `envoyerInvitationCollab`) envoyé à tous les beatmakers concernés uniquement à l'approbation, pas au rejet.
> - Vues admin et business transformées en tables de gestion réelles (au lieu de pastilles) : colonnes Beats/Ventes/Écoutes/CA net (stats déjà utilisées pour aider la décision de certification), lignes dépliables pour éditer nom/image, onglet "Demandes" séparé et sélectionnable (plus une box toujours visible).
>
> Fichiers de migration Phase 7 (à exécuter dans cet ordre si reproduit sur un nouvel environnement) : `phase7_categories.sql` → `phase7_8_categories_images.sql` → `phase7_9_demandes_certification.sql` → `phase7_10_regroupement_certification.sql` → `phase7_11_fix_categorie_id_nullable.sql`.

#### Checklist tests Phase 7 + Admin — ✅ 100% validée le 2026-07-20 (T0-T19)

**Préalable :**
- [x] **T0** — Migrations SQL exécutées (`phase7_categories.sql`, `phase7_8_categories_images.sql`, `phase7_9_demandes_certification.sql`, `phase7_10_regroupement_certification.sql`, `phase7_11_fix_categorie_id_nullable.sql`)

**Côté beatmaker (`/dashboard/business/categories`, `/dashboard/business/beats/nouveau`) :**
- [x] **T1** — Tags Styles/Ambiances/Instruments/Type Beat OK sur `/dashboard/business/beats/nouveau` (onglets, recherche, badge certifié)
- [x] **T2** — Ajout d'un style personnalisé inédit sur un beat
- [x] **T3** — Sélectionner un style déjà officiel sur un beat ne crée plus de doublon perso (bug corrigé)
- [x] **T4** — Catégorie perso visible dans "Tes catégories personnalisées" avec le bon compteur de beats
- [x] **T5** — Renommer une catégorie perso → cascade correcte sur les beats déjà tagués
- [x] **T6** — Le nom renommé apparaît dans "Mes Styles", plus l'ancien
- [x] **T7** — Upload d'image sur un artiste perso (Type Beat), conversion WebP automatique
- [x] **T8** — Ambiances/Instruments : toujours aucun moyen d'ajouter/renommer
- [x] **T9** — Demande de certification → badge "En attente de validation" (table dédiée)
- [x] **T10** — Annulation de demande → repasse en "Perso", redemandable

**Côté admin — regroupement des demandes (`/dashboard/admin/categories`) :**
- [x] **T11** — Deux demandes de noms identiques (casse différente) se regroupent en une seule ligne avec compteur
- [x] **T12** — Approuver ouvre un champ "Nom définitif" pré-rempli, modifiable
- [x] **T13** — Une seule catégorie officielle après approbation, compteur de beats agrégé correct
- [x] **T14** — Les beats des variantes de casse différente affichent le nom définitif choisi
- [x] **T15** — Email "Votre catégorie... est maintenant officielle" envoyé
- [x] **T16** — Rejet de groupe → toutes les demandes repassent en "Perso", aucune catégorie touchée

**Images & CA :**
- [x] **T17** — Override d'image de boutique sur une catégorie officielle, sans écraser l'image officielle admin
- [x] **T18** — CA net agrégé correctement sur toutes les boutiques concernées

**Sécurité :**
- [x] **T19** — Compte non-admin (déconnecté ou autre compte réel) → `/dashboard/admin` redirige vers `/dashboard/business`

#### Checklist tests Étape 15 lot 1 — Admin Recherche/Support + Log Stripe + Suspension ✅ Validée le 2026-07-24 (T13/T16 bloqués, système d'abonnement plateforme pas encore construit)

> **Contexte :** Premier lot de code de l'Étape 15 élargie, cadré par interview + scoring pertinence/dangerosité le 2026-07-24 (voir mémoire `project_admin_etape15_scope`). Items retenus : recherche multi-critères (15a), log des webhooks Stripe (15b), suspendre/réactiver une boutique avec pause en cascade des abonnements Stripe (15c), correction de champs bas risque sur un compte client/beatmaker (15a). Exclus définitivement : modifier une boutique à sa place (email/slug/Stripe Connect), supprimer un compte, corriger un statut de split/paiement collab.
>
> ⚠️ **À faire avant tout test** : exécuter la migration `supabase/phase15_1_admin_support.sql` dans l'éditeur SQL Supabase (crée `stripe_events`, ajoute le statut `suspendu` sur `abonnements_plateforme`/`abonnements_boutique`, les colonnes `suspendu_le`/`suspendu_raison`/`statut_avant_suspension`, et les fonctions de recherche par préfixe). Rien de tout ça n'a encore été testé par Jake.
>
> ⚠️ **Tester la suspension sur une boutique de test uniquement** (ex. `feedback.jakeb@gmail.com`, voir mémoire `project_compte_test_feedback_jakeb`) — la cascade met en pause de vrais abonnements Stripe (mode test), jamais une boutique réelle active.
>
> ⚠️ **Incident 2026-07-24 pendant les tests** : Jake a suspendu son propre compte admin (`jakeb-test`) et s'est retrouvé bloqué hors de `/dashboard/admin` (`estAdmin()` dépend de `beatmakers.statut`, et `proxy.ts` redirige tout `/dashboard/**` suspendu vers `/dashboard/suspendu`, y compris l'admin lui-même). Récupéré via un script ponctuel (service_role) qui a remis `statut='actif'` directement en base — aucune donnée Stripe n'avait été touchée (voir découverte ci-dessous). **Corrigé dans la foulée** : `suspendreAction` (`app/dashboard/admin/boutiques/[id]/_lib/actions.ts`) refuse désormais explicitement de suspendre le compte dont le slug est `SLUG_ADMIN` (exporté depuis `lib/admin.ts`).
>
> ⚠️ **Découverte pendant l'incident** : les 39 `abonnements_boutique` de `jakeb-test` sont des données de **seed SQL** (`supabase/seed_abonnements.sql`) avec de faux `stripe_subscription_id` qui n'existent pas sur Stripe (`No such subscription`) — la cascade de pause a échoué proprement dessus (comportement attendu, rien de cassé), mais ça veut dire que T13/T14 (vérification réelle de `pause_collection` sur Stripe) n'ont pas pu être validés sur cette boutique. **Utiliser une boutique dont les abonnements viennent d'un vrai passage en caisse Stripe test** (ex. `feedback.jakeb@gmail.com` / "Jake 2") pour ces deux tests, pas `jakeb-test`.

**Préalable :**
- [x] **T0** — Migration `phase15_1_admin_support.sql` exécutée sans erreur

**Recherche (`/dashboard/admin/recherche`) :**
- [x] **T1** — Recherche par email d'un beatmaker → apparaît dans "Boutiques"
- [x] **T2** — Recherche par slug d'un beatmaker → même résultat
- [x] **T3** — Recherche par email d'un client → apparaît dans "Clients (artistes)"
- [x] **T4** — Recherche par préfixe d'ID d'une commande (les 8 caractères affichés `#XXXXXXXX` dans `/dashboard/business/commandes`) → apparaît dans "Commandes", lien fonctionne *(bug trouvé et corrigé en cours de test : "email inconnu" affiché sur les commandes d'abonnement — `acheteur_email` jamais renseigné par `traiterPaiementAbonnement`, fallback ajouté vers `clients.email`)*
- [x] **T5** — Recherche par préfixe d'ID d'un abonnement boutique (`A-XXXXXXXX`) → apparaît dans "Abonnements boutique", lien fonctionne

**Fiche boutique (`/dashboard/admin/boutiques/[id]`) :**
- [x] **T6** — Stats affichées (clients, commandes, statut abo plateforme, artistes abonnés actifs) cohérentes avec les données réelles de la boutique de test
- [x] **T7** — Correction d'un champ bas risque (ex. téléphone, tagline) → sauvegarde visible après rechargement
- [x] **T8** — Email, slug et Stripe Connect bien absents du formulaire d'édition (lecture seule uniquement)

**Suspension (boutique de test uniquement) :**
- [x] **T9** — Clic "Suspendre" sans raison → bouton désactivé/bloqué (raison obligatoire)
- [x] **T10** — Suspension avec raison → rapport affiché cohérent (abo plateforme + nombre d'artistes mis en pause) *(validé sur `jakeb-test1` avec un vrai abonnement Stripe test — a aussi révélé et corrigé un bug : un abonnement artiste sans compte Connect était ignoré au lieu d'être mis en pause)*
- [x] **T11** — Le beatmaker suspendu, en se connectant à son dashboard, est redirigé vers `/dashboard/suspendu` avec le bon motif affiché *(validé pendant l'incident d'auto-suspension du compte admin, voir note plus haut)*
- [x] **T12** — La boutique publique `/{slug}` de test affiche "temporairement indisponible" (plus de header/player/catalogue)
- [ ] **T13** — 🔒 **Bloqué, pas juste "pas encore testé"** — le système d'abonnement plateforme (beatmaker → My Producer) lui-même n'est pas encore construit/fonctionnel (confirmé le 2026-07-24 : zéro ligne `actif`/`en_essai` dans `abonnements_plateforme` sur toute la base, aucun beatmaker n'a jamais pu s'abonner). Le code de pause côté `lib/admin-boutiques.ts` est prêt et suit la même logique que T14 (déjà validée), mais ne sera testable qu'une fois ce système construit ailleurs dans le roadmap
- [x] **T14** — Sur le Dashboard Stripe (mode test) : les abonnements artistes actifs de cette boutique passent bien en pause *(validé sur `jakeb-test1` — badge "Recouvrement suspendu" confirmé)*
- [x] **T15** — Réactivation → dashboard et boutique publique de nouveau accessibles immédiatement
- [ ] **T16** — 🔒 Bloqué, même raison que T13 — pas d'abonnement plateforme testable actuellement
- [x] **T17** — Les abonnements artistes repassent à `actif` et la pause Stripe est retirée sur chacun *(validé sur `jakeb-test1` — badge "Recouvrement suspendu" disparu, confirmé après le fix du webhook `customer.subscription.updated`)*

**Fiche client (`/dashboard/admin/clients/[id]`) :**
- [x] **T18** — Liste des boutiques (leads) et commandes récentes affichée correctement
- [x] **T19** — Correction d'un champ bas risque (ex. téléphone) → sauvegarde visible ; email non éditable

**Fiches commande/abonnement en lecture seule :**
- [x] **T20** — `/dashboard/admin/commandes/[id]` affiche le détail correct (articles, montants, liens boutique/client fonctionnels)
- [x] **T21** — `/dashboard/admin/abonnements/[id]` affiche le détail correct (plan, prix, dates, liens boutique/client fonctionnels)

**Log Stripe (`/dashboard/admin/stripe-events`) :**
- [x] **T22** — Un paiement de test déclenche bien une ligne "traite" dans le log, quasi en temps réel
- [x] **T23** — Filtre "Échecs uniquement" fonctionne (provoquer un échec de traitement pour vérifier, ex. webhook rejoué sur une donnée déjà supprimée)
- [x] **T24** — Un webhook rejoué par Stripe (bouton "Renvoyer" dans le Dashboard Stripe) met à jour la même ligne au lieu d'en créer une nouvelle (upsert sur `stripe_event_id`)

**Sécurité :**
- [x] **T25** — Compte non-admin (déconnecté ou autre compte réel) → toutes les routes `/dashboard/admin/**` redirigent vers `/dashboard/business` *(validé pour non-connecté → `/connexion`, comportement proxy.ts confirmé correct)*

#### Checklist tests Étape 8b — Abonnement plateforme ⬜ À tester

> **Contexte :** Découverte le 2026-07-24 que ce système n'avait jamais été construit (voir mémoire `project_abonnement_plateforme_decouverte`). V1 minimale : 1 plan (mensuel 49,99€ / annuel 499,90€), essai 14 jours + CB obligatoire, accès total ou rien — pas de blocage d'accès réel dans ce lot (volontairement différé, voir plus bas).
>
> ⚠️ **À faire avant tout test** :
> 1. Exécuter `supabase/phase8b_abonnement_plateforme.sql` dans l'éditeur SQL Supabase (grants INSERT service_role + SELECT authenticated sur `abonnements_plateforme`).
> 2. Ajouter sur Vercel (Production ET Preview) les variables d'environnement `STRIPE_PRICE_PLATEFORME_MENSUEL` et `STRIPE_PRICE_PLATEFORME_ANNUEL` (valeurs déjà dans `.env.local`, créées en mode test Stripe le 2026-07-24) — sans ça la route de checkout renvoie une erreur 500.
> 3. Tester avec un compte beatmaker de test qui n'a **jamais** d'abonnement plateforme (n'importe lequel des `jakeb-testN` fait l'affaire).

**Préalable :**
- [ ] **T0** — Migration `phase8b_abonnement_plateforme.sql` exécutée + variables d'env Vercel ajoutées

**Souscription (`/dashboard/abonnement`) :**
- [x] **T1** — Sans abonnement existant, la page affiche le choix mensuel/annuel avec le bon prix affiché pour chaque option
- [x] **T2** — Clique "Mensuel" → "Démarrer l'essai gratuit" → redirection vers Stripe Checkout, carte demandée (4242 4242 4242 4242), essai affiché à 0€ pendant 14 jours
- [x] **T3** — Après paiement (carte enregistrée), retour sur `/dashboard/abonnement?succes=1` → la page affiche maintenant "Essai gratuit", prix mensuel, date de fin d'essai à J+14
- [x] **T4** — Une ligne apparaît dans `abonnements_plateforme` (vérifiable via `/dashboard/admin/recherche`, onglet Boutiques → fiche → stat "Abo. plateforme") avec `statut = 'en_essai'`

**Vérif Stripe :**
- [ ] **T5** — Sur le Dashboard Stripe test (`/test/subscriptions`), l'abonnement créé apparaît avec le statut "En période d'essai" (trialing)
- [ ] **T6** — Le log `/dashboard/admin/stripe-events` montre les événements `checkout.session.completed` et `customer.subscription.created` traités sans erreur

**Portail Stripe :**
- [ ] **T7** — Bouton "Gérer mon abonnement" → redirige vers le portail Stripe (Billing Portal), sans erreur

**Annulation (via le portail Stripe) :**
- [ ] **T8** — Annule l'abonnement depuis le portail → `abonnements_plateforme.statut` repasse à `annule` (vérifiable en base ou via la fiche admin)

**Second essai (annuel) :**
- [ ] **T9** — Avec un autre compte de test, refaire T1-T4 en choisissant "Annuel" → prix et période corrects en base (`periode = 'annuel'`, `prix = 49990`)

**Garde-fou : pas de blocage d'accès dans ce lot :**
- [ ] **T10** — Un compte beatmaker **sans aucun abonnement plateforme** peut toujours accéder normalement à `/dashboard` et `/dashboard/business` — confirme que le gate d'accès n'a bien PAS été activé par erreur dans ce lot (différé volontairement à un lot séparé)

### Phase 8 — Dashboard business (accueil) ⬜ À faire

> **Contexte :** Repoussée en dernier (décision 2026-07-02) — cette page agrège des KPIs et alertes de **tous** les modules business, y compris Marketing (Phases 4-5), Mailing (Phase 6) et Catégories (Phase 7) qui n'existaient pas encore. La coder avant ces modules obligerait à la refaire.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 8.1 | Page `/dashboard/business/` : KPIs du mois, nouveaux clients, abonnés actifs, alertes, liens rapides | ⬜ |

---

## Étape 12 — Free Download (boutique + CRM)

> **Contexte :** Permettre aux visiteurs de télécharger gratuitement les beats marqués `free_download_actif = true`. Génère automatiquement un lead `source = 'free_download'` et log dans `free_downloads`. Décision prise le 2026-06-13.

### Décisions clés

- **Téléchargement :** double livraison — URL R2 signée retournée directement (DL immédiat) + email Resend avec le même lien (assurance si fermeture fenêtre)
- **Disclaimer :** message hardcodé V1 (usage personnel, maquette, réseaux OK, streaming interdit) — paramétrable par beatmaker en V2
- **Compte :** inscription obligatoire via 2 checkboxes (newsletter + création compte). Compte invité créé si non connecté (même pattern que webhook Stripe)
- **Source lead :** si le visiteur est déjà lead/client, la source existante est conservée (pas d'écrasement). Seul un nouveau lead prend `source = 'free_download'`
- **Fichier livré :** `mp3_tague_url` (MP3 taguée, seul fichier disponible sans achat de licence)

### Sous-étapes

| # | Sous-étape | Fichiers touchés | Statut |
|---|-----------|-----------------|--------|
| 12.1 | SQL : GRANT service_role sur `free_downloads` + vérification table créée | `supabase/service_role_grants.sql` | ⬜ |
| 12.2 | Boutique — page catalogue : ajouter `free_download_actif` dans SELECT + prop `BeatPublic` + badge sur `BeatCard` | `app/[slug]/page.tsx` · `BeatCard.tsx` | ⬜ |
| 12.3 | Boutique — page beat : ajouter `free_download_actif` dans SELECT + section "Télécharger gratuitement" | `app/[slug]/[beatId]/page.tsx` | ⬜ |
| 12.4 | Composant `FreeDLModal.tsx` : disclaimer + formulaire email/checkboxes (non connecté) ou bouton direct (connecté) | `app/[slug]/_components/FreeDLModal.tsx` (nouveau) | ⬜ |
| 12.5 | API POST `/api/free-download` : vérif beat, upsert client, upsert lead, insert free_downloads, signed URL + email Resend | `app/api/free-download/route.ts` (nouveau) | ⬜ |
| 12.6 | Dashboard — Fiche client onglet Activité : remplacer placeholder par requête réelle `free_downloads` | `app/dashboard/business/contacts/[id]/page.tsx` | ⬜ |

### Règles métier importantes

- Un beat `free_download_actif = true` doit avoir un `mp3_tague_url` non null — sinon le bouton est masqué
- Un client connecté qui a déjà téléchargé ce beat → le bouton reste actif (re-téléchargement autorisé, log quand même)
- Un client connecté qui a **acheté** ce beat → afficher "Vous avez acheté ce beat" à la place du bouton Free DL
- `free_downloads.achete` : mis à `true` automatiquement si une commande pour ce beat existe déjà (à la requête)

---

## Journal des sessions

| Date | Étapes travaillées | Résumé |
|------|--------------------|--------|
| 2026-05-02 | Étape 1 | Setup Next.js, apprentissage Git/GitHub, initialisation du projet beatplatform |
| 2026-05-13 | Étape 1 | ✅ Étape 1 complète. Supabase configuré, Vercel déployé (beatplatform.vercel.app), compte Cloudflare créé. |
| 2026-05-13 | Étape 2 | Début étape 2 : schéma de la base de données conçu. Tables beatmakers et beats entièrement définies. |
| 2026-05-14 | Étape 2 | ✅ Étape 2 complète. 9 tables créées dans Supabase via SQL. RLS activé. Contraintes et index ajoutés. |
| 2026-05-14 | Étape 3 | ✅ Étape 3 complète. Resend SMTP configuré, fix Gmail OTP scanning, trigger beatmakers auto-créé, RLS policies. |
| 2026-05-14 | Étape 4 | Début étape 4. Prochaine action : configurer Cloudflare R2. |
| 2026-05-15 | Étape 4 | 4.1→4.7 validés. R2 configuré, SDK S3, formulaire beats, upload fichiers, collaborateurs/splits, catalogue dashboard, édition et suppression. |
| 2026-05-15 | Étape 5 | ✅ Étape 5 complète. Boutique publique /[slug] avec player audio global, filtres, page beat individuelle. Fix R2 public URL. |
| 2026-05-15 | Étape 5b | ✅ Profil beatmaker : slug personnalisable, logo R2, tagline, réseaux sociaux. Déploiement Vercel fonctionnel. |
| 2026-05-15 | Étape 6 | 6.1 ✅ Compte Stripe My Producer créé (distinct de Jakebmusic), Connect activé, modèle Plateforme + Express accounts. 6.2 ✅ SDK Stripe installé (lib/stripe.ts + lib/stripe-client.ts). Décisions TVA documentées. |
| 2026-05-18 | Étape 6 | ✅ Étape 6 complète. Webhook configuré, SUPABASE_SERVICE_ROLE_KEY ajouté, GRANT commandes service_role, test paiement bout en bout validé (45€ WAV, commande créée en BDD). |
| 2026-05-18 | Étape 7 | ✅ Étape 7 validée bout en bout. Fix : GRANT SELECT service_role sur beats/licences/beatmakers/beat_splits. Téléchargement direct (Content-Disposition). Page /telechargement permanente (liens régénérés à chaque visite). |
| 2026-05-18 | Étape 8 | ✅ Étape 8 validée bout en bout. Dashboard config plan (nom, prix, remise, essai). Checkout Stripe subscription mode + trial. Cookie session membre. Catalogue privé avec cadenas. Pages /abonnement, /membres, /mon-abonnement. Remise affichée sur fiche beat (prix barré). Illimité + Exclusive exclus de la remise. Webhook customer.subscription.updated/.deleted. |
| 2026-05-19 | Étape 9 | ✅ Étape 9 validée. 10 tests passés : inscription/connexion/déconnexion artiste, header boutique connecté, checkout invité+connecté, favoris (like/unlike/persistance/page), beats privés via session, /mon-abonnement via session, liaison auto achats existants. Bugs RLS corrigés : GRANT authenticated sur favoris/beats/beat_licences, fallback admin beatmakers, client_id enregistré à l'abonnement, remise checkout via session, annulation abonnement via session + UX confirmation. |
| 2026-05-19 | Correctifs post-étape 9 | ✅ Espace compte client par boutique : nouvelle page `/{slug}/mon-compte` (abonnement + favoris preview + achats preview + déco). Pages dédiées `/{slug}/mon-compte/favoris` (playlist avec player prev/next) et `/{slug}/mon-compte/achats`. Déconnexion redirige vers la boutique. Lien "Mon compte" dans le header pointe vers `/{slug}/mon-compte`. Prochaine étape : 10 (Split collab). |
| 2026-05-19 | Planification étape 10 | Détail des 9 sous-étapes Split collab finalisé. Décisions clés : transit Stripe (My Producer pas deemed supplier, custodian = Stripe), email invitation publication + email fonds en attente à la vente, rappels J+30/J+50 + reversal automatique J+60 vers beatmaker A, /dashboard/mes-collabs lecture seule, analytics collabs en étape 13. |
| 2026-05-19 | Étape 10 (code) | ✅ 10.1→10.8 complétés. Checkout transfer_group, webhook splits + transfers Stripe, emails Resend (invitation/fonds/rappel/expiration), /dashboard/splits, /dashboard/mes-collabs, webhook account.updated, cron quotidien J+30/J+50/J+60. Vercel env vars configurées (RESEND_API_KEY, NEXT_PUBLIC_APP_URL, CRON_SECRET). account.updated ajouté dans Stripe webhook. Tests 10.9 en attente de validation Jake. |
| 2026-05-19 | Étape 10 (tests) | ✅ Étape 10 validée. 7 tests T1→T7 passés. 4 bugs corrigés en cours de test : (1) lazy-init Resend évite plantage build si RESEND_API_KEY absente ; (2) cookie abo_* supprimé à la déconnexion artiste ; (3) /dashboard/mes-collabs query par beatmaker_id ET email_invite (déduplication) ; (4) beat_splits liés au beatmaker dès connexion Stripe Connect + endpoint /api/stripe/splits/debloquer pour retry splits en_attente. Limitation test mode Stripe documentée : transfers nécessitent solde disponible (carte 4000000000000077 plutôt que 4242). En production les vrais paiements alimentent le solde plateforme en continu. |
| 2026-05-20 | Homepage + Étape 11 (code) | ✅ Page d'accueil My Producer créée (deux entrées : beatmaker / artiste, lien boutique démo jakeb-test). Étape 11 CRM codée : liste clients agrégée (commandes + abonnements + clients), fiche client avec historique, détection doublons fuzzy matching + bouton Ignorer. Import BeatStars retiré (sera fait après analyse du vrai CSV). Fix middleware : toutes les pages /dashboard/* bloquées pour les artistes (redirection /mon-compte). Migration SQL étape 11 exécutée. |
| 2026-05-20 | Étape 11 (tests) | ✅ Étape 11 validée. 4 tests T1→T4 passés : liste CRM (stats + filtres Acheteurs/Abonnés/Leads), fiche client (historique + abonnement Plan Standard), doublons (page charge, message correct avec 1 seul client ayant un compte). |
| 2026-05-20 | Étape 11b — Résolution client (bonus) | ✅ FK clients→auth.users supprimé. Webhook Stripe crée/résout le client par email à chaque achat. lierCompteClient fusionne le compte invité dans le compte auth à l'inscription. 15 clients fictifs + 45 commandes + 5 abonnements insérés en BDD pour tests réalistes. Fix affichage prix abonnement (centimes → décimales : 6,99€/mois). |
| 2026-05-20 | Optimisation CRM (11c) — décisions initiales | Analyse du CRM Airtable de Jake. Décisions prises pour 3 sprints : badge Statut client, LTV, Langue, Instagram, newsletter. À coder en session suivante. |
| 2026-05-21 | Optimisation CRM (11c) — architecture complète | Revue exhaustive de toutes les tables Airtable (CLIENTS, COMMANDES, ABONNEMENTS, IDENTIFIANTS). Validation donnée par donnée (liste vs fiche). Architecture CRM étendue à 5 sprints. Décisions clés : 2 dimensions de statut indépendantes (abonnement + achat), LTV inclut tout, mois réglés = compteur réel, préférences musicales depuis achats+favoris. Leads : définition, sources, score chaleur, affichage CRM. Email marketing Resend : templates brandés, domaine `[slug]@mail.myproducer.com` par défaut + domaine pro (pas de webmail). Sprint 1 entièrement planifié (14 sous-étapes, 0 BDD). |
| 2026-05-21 | Optimisation CRM (11c) — Sprint 1 + Sprint 2 ✅ | Sprint 1 : badge statut abo 3 états, filtres, LTV, langue, dernière commande, style/type beat, préférences musicales (achats×2 + favoris×1). Sprint 2 : type_commande, mensualites_payees, LTV réelle (webhook invoice.payment_succeeded), instagram éditable, newsletter_consent + checkbox inscription + toggle mon-compte + export CSV. Migration SQL : supabase/sprint2_crm.sql exécutée. |
| 2026-05-21 | Optimisation CRM (11c) — Sprint 3 ✅ | Score RFM (R/F/M /5 → score /100). 8 segments auto (Champion/Fidèle/Potentiel/À risque/Dormant/À réactiver/Nouveau/Lead). KPIs ligne 2 cliquables. LTV moyenne. Section "Actions recommandées" (3 vues métier). 6 filtres segments. Badge segment dans chaque ligne. Fiche : bloc RFM complet avec description. Fix nbAchats + historique labels. |
| 2026-06-12 | Outil Business (11d) — Plan validé | Session grill-me : 14 décisions d'architecture prises. Plan de migration crm-proto → /dashboard/business en 4 phases (Foundation → CRM → Commerce → Analytics → Dashboard). Décisions clés : layout dédié, suppression anciennes routes, codes promo table Supabase, splits supprimés, Marketing en placeholder 🔒, analytics onglet par onglet. Roadmap mise à jour. |
| 2026-06-13 | Outil Business (11d) — Phase 0 + CRM 1.1 + 1.2 ✅ | Foundation validée (SQL + layout + sidebar). Vue Contacts : 4 onglets (Tous/Clients/Abonnés/Leads), KPIs, filtres, préférences. Vue Leads : score chaleur, 20 leads de test. Fiche client : 7 onglets (Identité/Abonnement/Commandes/Préférences/Newsletter/Activité/Morceaux). Fix lead 42501 : GRANT authenticated + service_role manquants sur table `leads`. |
| 2026-06-13 | Étape 12 — Free Download — Décisions | Périmètre complet planifié : boutique (badge BeatCard + modal + page beat) + API (client invité + lead upsert + free_downloads + signed URL + email Resend) + dashboard fiche client Activité. 6 sous-étapes documentées. Double livraison (DL direct + email). **PROCHAINE ÉTAPE : 12.1 SQL puis 12.2→12.6 code.** |
| 2026-06-15 | Outil Business (11d) — Phase 1.3 Doublons ✅ | Page Doublons complète : algorithme Levenshtein (email + nom + téléphone), KPIs, paires ignorer/désignorer, fusion manuelle via FusionWizard, historique des fusions (défusion possible). Table `fusions_crm` + `doublons_ignores`. |
| 2026-06-17 | Outil Business (11d) — Fiche client + Phase 1.4 Segments ✅ | Fiche client : surnom CRM, nom_artiste, téléphone et langue éditables (bouton save inline). Segments : filter builder ET/OU custom, badge statut intégré comme condition (est/n'est pas/est parmi), compteurs dynamiques, edit mode, dropdowns catalogue. |
| 2026-06-19 | Outil Business (11d) — Phase 1.5 Listes + Phase 2.1 Commandes ✅ | Listes CRM : création/modification/suppression + détail liste, ajout/retrait contacts depuis modale, sélecteur de colonnes dynamique (15 colonnes, localStorage), drag & drop sur les headers. Commandes : liste complète + fiche détail (Articles HT/TVA, Historique téléchargements, Liens, Timeline auto, Remboursement, Renvoyer email). Fix fiche commande : admin client pour join clients. |
| 2026-06-20 | Bug fix — Historique téléchargements ✅ | `licence_downloads` manquait d'un `GRANT INSERT TO service_role`. Ajout `supabase/licence_downloads_grants.sql`. Historique téléchargements fonctionnel (date, fichier, IP). Comportement confirmé : les DL depuis le dashboard beatmaker ne sont pas loggués (correct). |
| 2026-06-24 | Outil Business (11d) — Phase 2 Commerce ✅ | 6 pages migrées vers `/dashboard/business/` : Abonnements (liste + fiche + actions Stripe annuler/réactiver), Plans, Beats (catalogue avec CA/ventes/licences actives via `beat_licences`), Codes promo (module complet : création/édition/duplication/statut), Licences, Collabs. Anciennes routes dashboard supprimées en fin de phase. |
| 2026-06-25 | Codes promo checkout + lancement Analytics (Phase 3, 11d) | Codes promo appliqués **côté serveur avant Stripe** (restriction email vérifiée au "Confirmer", licences éligibles). Collabs : détail des ventes par beat + relevé PDF annuel. Module Analytics lancé : tracking écoutes (seuil 30s), 7 onglets. Fix unités critique : `commandes.prix_paye`/`reduction_montant` sont en **euros décimaux**, pas en centimes (contrairement à `split_payments.montant` qui reste en centimes). |
| 2026-06-26 | Analytics — enrichissements + nettoyage dashboard | KPI favoris + ARR sur Vue d'ensemble, CA net isolé en KPI indépendante (Ventes), page détail beat (favoris, CA par licence/source, tables dynamiques par KPI, colonnes N° commande + client cliquables), fix graphiques (marge, axe Y). Suppression des dernières pages `/dashboard/*` dupliquées avec `business/`. |
| 2026-06-27 | Analytics — tracking sources marketing + durée d'écoute | 9 sources trackées de la visite à la commande (YouTube, Instagram, TikTok, Google, Google Ads, YouTube Ads, Newsletter, Direct, Autre) — détection via UTM/gclid/gbraid/referrer. Durée d'écoute (`PlayerContext` + endpoint dédié, envoi sur navigation + `visibilitychange`). Ventes : KPIs cliquables pilotent le graphique, légende source interactive. Granularité adaptative des graphiques + périodes semaine. Nouvelle mise en page catalogue boutique (membres en premier). |
| 2026-06-29 | Analytics — page détail beat + Abonnements | Granularité adaptive + tooltip `fullLabel` sur le détail beat, panier moyen sur Overview. KPIs Abonnements réactifs à la période sélectionnée. Churn : nombre d'annulations affiché en plus du taux. |
| 2026-07-02 | Analytics — Abonnements, Revenus, Préférences, Codes promo | **Abonnements** : 5 KPIs cliquables, badges Actuel/Tous temps/Cette période, rétention moyenne cliquable avec snapshot par slot. **Décision CA net = CA HT** (`brut − remises − TVA`) actée et appliquée à tout le module (Overview/Ventes/Revenus, puis Codes promo). **Revenus** : CA moyen net/brut sélectionnable, colonne "Remises" (remplace "Codes promo"). **Préférences** : sélecteur de catégorie pour le graphique, fix ligne "Autre" et KPIs. **Codes promo** : colonne Type (panier/produit/abonnement), code cliquable vers la fiche Commerce, CA brut (TTC)/net (HT) distingués en KPI + colonnes tableau, toutes les données scopées à la période sélectionnée, codes sans utilisation sur la période masqués du tableau. Jeu de données de test ajouté : 10 codes promo + 30 commandes sur la boutique test (`supabase/seed_codes_promo.sql`) pour valider visuellement les changements. |
| 2026-07-02 | Outil Business (11d) — Phases 4-8 planifiées + Admin (15) élargi | Session de planification (pas de code). Analyse du code existant : `campagnes` (Phase 0) créée mais jamais branchée (ni colonne `contenu`), `lib/emails.ts` ne couvre que les splits/collab (aucune confirmation commande/abonnement n'existe), catégories hardcodées dans `BeatForm.tsx` (`TagSelector` fixe pour Ambiances/Instruments, `HybridTagSelector` pour Styles/Type beat — déjà proche du modèle cible), sidebar avec section "Marketing" déjà verrouillée 🔒 (Campagnes/Templates placeholder, `Sidebar.tsx`). Décisions actées : Automatisations en recettes prédéfinies custom mais déclencheur stocké en config JSON générique dès le départ (évolutif vers 100% custom) ; Transactionnels = template par défaut + quelques champs éditables (pas d'éditeur libre) ; double email de bienvenue (plateforme fixe + boutique configurable, rangé dans Automatisations) ; certification catégories validée manuellement en V1, mais nécessite un vrai back-office Admin (perf SaaS + perf par boutique + modération) obligatoire avant la publication officielle (étape 17). **Resequencing (Jake) :** Dashboard business (accueil) repoussé en dernier (Phase 8) car il agrège des KPIs de tous les modules. **Fusion (Jake) :** Sprint 4 CRM (11c, Campagnes manuelles jamais codées) fusionné avec les Automatisations dans un même chantier Marketing (Phase 4 Fondations+Campagnes → Phase 5 Automatisations) car les deux partagent le même socle technique (ciblage segment + templates + envoi Resend) — construit une seule fois. Étape 15 (Admin) élargie en conséquence. **Prochaine étape : Phase 4 (Marketing : Fondations + Campagnes).** |
| 2026-07-02 | Marketing (11d Phase 4) — 4.1 + 4.2 ✅ | Session de code. Analyse de la maquette crm-proto (wizard 3 étapes, éditeur de blocs, bibliothèque de templates) pour calibrer le design réel. Décisions validées par Jake : éditeur de templates en "blocs simplifiés" (pas de drag-and-drop) et envoi "fait maison" (pas Audiences/Broadcasts Resend). **4.1** : `supabase/marketing_migration.sql` (tables `templates_email` + `campagne_envois`, colonne `campagnes.contenu`, domaine d'envoi sur `beatmakers`, seed de 4 templates officiels) + `supabase/marketing_migration_ciblage.sql` (colonnes `cible_mode`/`cible_id`/`cible_emails` sur `campagnes`, remplace `segment_slug` jamais utilisé). **4.2** : `lib/mailing.ts` (ciblage segment/liste/manuel avec filtre RGPD systématique, tokens `{{prénom}}`/`{{style_préféré}}`/etc., lien de désinscription signé HMAC, envoi par lots de 100 via `resend.batch.send`) + `lib/email-blocs.ts` (rendu HTML des 6 types de blocs, y compris requêtes beats pour les sections beats). Refactor : la logique de chargement des contacts (dupliquée entre Segments liste et détail) extraite dans `app/dashboard/business/_lib/contacts.ts`, réutilisée par les deux pages Segments et par `lib/mailing.ts` — comportement inchangé, vérifié via `tsc`/`eslint`. **Décision prise seul (à valider) :** les blocs "section beats" dans l'email n'affichent pas le prix (juste image + titre + lien) pour éviter de dupliquer la logique de pricing par licence de la boutique. **Nouvelle variable d'env requise sur Vercel :** `UNSUBSCRIBE_SECRET`. **Prochaine étape : 4.3 (page Campagnes).** |
| 2026-07-02 | Marketing (11d Phase 4) — 4.3 + 4.7 ✅ | **Bug trouvé et corrigé** : `lib/mailing.ts` ciblait `listes_contacts`/`liste_membres` (tables Phase 0, jamais utilisées) au lieu des vraies tables `listes_crm`/`listes_crm_contacts` (créées plus tard dans `supabase/listes_crm.sql`, celles utilisées par la page Listes réelle) — corrigé avant que ça casse le ciblage par liste. **4.3** : page `/dashboard/business/marketing/campagnes/` (KPIs, 3 sections Planifiées/Brouillons/Historique, wizard de création en 3 étapes Destinataires→Objet→Template) + nouveau cron quotidien `/api/cron/campagnes` (traite les campagnes planifiées, même pattern que `splits-expiration`, ajouté à `vercel.json` à 8h) — **limite à connaître : une campagne "planifiée à 10h" part au prochain passage du cron (une fois/jour), pas à la minute précise**. Bouton "Lancer une campagne" sur la fiche Segment débloqué (pré-sélectionne le segment dans le wizard). **4.7** : sidebar Marketing déverrouillée. Tables `listes_contacts`/`liste_membres` (Phase 0) confirmées mortes — à supprimer plus tard si Jake valide. **Prochaine étape : 4.4 (éditeur de templates, blocs simplifiés).** |
| 2026-07-02 | Marketing (11d Phase 4) — Premier envoi réel validé ✅ | Session de debug avec Jake sur une campagne test (segment/liste/manuel via l'assistant). 3 bugs trouvés et corrigés en série : (1) erreur d'envoi totalement silencieuse (aucun message, aucun log) — `genererLienDesinscription` hors du try/catch dans la boucle d'envoi, corrigé ; (2) message d'erreur trompeur "aucun destinataire" pour une campagne orpheline créée avant l'assistant (sans `cible_mode`) — messages désormais distincts (`sans_ciblage` vs `aucun_destinataire`) ; (3) **cause racine réelle**, trouvée via les logs Vercel (`permission denied for table campagnes`, code 42501) : `campagnes` et `listes_crm`/`listes_crm_contacts` n'avaient jamais reçu de `GRANT ... TO service_role` (seulement `authenticated`, accordé en Phase 0 / `listes_crm.sql`) — `lib/mailing.ts` utilise le client admin (service_role) pour l'envoi, Postgres refusait donc l'accès sans qu'aucune exception ne remonte proprement. Fix : `supabase/marketing_migration_grants.sql`. **Premier envoi réel réussi** (3 destinataires, "Liste test"). Bonus : bug préexistant trouvé et corrigé dans la fiche détail Liste CRM (colonnes inexistantes interrogées sur `leads`, affichait "—" pour tout le monde en Newsletter). Domaine d'envoi basculé temporairement sur `campagnes@jakebmusic.com` (déjà vérifié dans Resend) en attendant la vraie 4.5. **Ouvertures/clics restent à 0** : normal, pas un bug — c'est 4.6 (webhook Resend) qui n'existe pas encore. **Prochaine étape : 4.6 (webhook Resend — tracking + désinscription).** |
| 2026-07-02 | Marketing (11d Phase 4) — 4.6 ✅ | Webhook Resend (`/api/resend/webhook`) : vérifie la signature via `resend.webhooks.verify()` (svix), gère `email.opened`/`email.clicked`/`email.bounced`/`email.complained`, met à jour `campagne_envois` (par `resend_message_id`) et incrémente les compteurs agrégés sur `campagnes` (une seule fois par email, pas à chaque relance d'ouverture). Route `/api/marketing/desinscription` : vérifie le token signé (étendu pour inclure le `campagneId`, pas seulement client+beatmaker), passe `clients.newsletter_consent` et `leads.newsletter_inscrit` à `false`, marque `campagne_envois.desinscrit_at`, page de confirmation minimale. Nouvelle colonne `campagne_envois.desinscrit_at` (`marketing_migration_webhook.sql`). **Reste à faire côté Jake** : créer le webhook dans le dashboard Resend (URL `/api/resend/webhook`, événements opened/clicked/bounced/complained) et ajouter `RESEND_WEBHOOK_SECRET` sur Vercel. **Prochaine étape : 4.4 (éditeur de templates) ou 4.8 (tests bout en bout) — Jake à trancher.** |
| 2026-07-02 | Marketing (11d Phase 4) — Tracking validé + conversions ajoutées ✅ | Premier envoi réel testé de bout en bout avec succès par Jake : ouvertures/clics remontent bien après configuration du webhook Resend + activation du tracking sur le domaine jakebmusic.com (sous-domaine `links.jakebmusic.com`, CNAME vérifié). Historique affiche désormais le chiffre brut en plus du pourcentage (`pct()` dans `CampagnesClient.tsx`). **Conversions** (jusque-là jamais branchées, `campagnes.conversions` toujours à 0) : ajout de `enregistrerConversion()` dans `lib/mailing.ts`, appelée depuis `traiterPaiement()` (webhook Stripe) juste après la création de la commande — attribution "dernier contact" : si le client a reçu une campagne de ce beatmaker dans les 30 derniers jours et n'a pas déjà été compté, marque `campagne_envois.converti_at` et incrémente `campagnes.conversions`. Nouvelle colonne `campagne_envois.converti_at` (`marketing_migration_conversions.sql`). Ne fait jamais échouer le paiement (erreurs catchées et loguées uniquement). **Reste à faire côté Jake** : exécuter `marketing_migration_conversions.sql`. **Phase 4 fonctionnelle de bout en bout** (envoi, ciblage, tracking, désinscription, conversions) — reste 4.4 (éditeur), 4.5 (vrai domaine par boutique), 4.8 (tests formels). |
| 2026-07-02 | Marketing (11d Phase 4) — Attribution conversions par clic (remplace le premier jet) ✅ | Jake a identifié deux failles dans l'attribution "email + fenêtre 30j" du commit précédent : (1) un client qui clique depuis la campagne mais achète avec un autre email n'était jamais compté ; (2) un client qui reçoit la campagne mais achète en direct (sans cliquer) était compté à tort. **Nouvelle architecture, sur le modèle du lien de désinscription (jeton signé HMAC, pas de dépendance tierce)** : chaque lien de contenu dans l'email (CTA, beats, "voir la boutique" — pas le lien de désinscription) est enveloppé via `genererLienClic()`/`envelopperLiensSuivi()` dans `lib/mailing.ts`, pointant vers la nouvelle route `/api/marketing/clic`. Cette route vérifie le jeton, marque le clic (`campagne_envois.clique_at` + compteur), pose un **cookie httpOnly** (`mp_click`, 30 jours) contenant le même jeton, puis redirige — avec protection anti-open-redirect (la destination doit commencer par `NEXT_PUBLIC_APP_URL`). `/api/stripe/checkout` lit ce cookie et l'ajoute aux métadonnées Stripe (`campagne_id`/`campagne_client_id`) uniquement si le beatmaker du jeton correspond à celui du beat acheté. Le webhook Stripe utilise ces métadonnées pour l'attribution — `enregistrerConversionParClic()` remplace l'ancienne `enregistrerConversion()` (heuristique par email supprimée). Résout les deux cas : clic + email différent → suivi via le cookie, pas l'email ; pas de clic → pas de cookie → pas de fausse conversion. Fonctions de jeton généralisées (`genererToken`/`verifierTokenCampagne`), réutilisées par désinscription et suivi de clic. Aucune nouvelle migration SQL (réutilise `campagne_envois.clique_at`/`converti_at` déjà créés). |
| 2026-07-02 | Marketing (11d Phase 4) — Décision finale attribution conversions ✅ | Jake a soulevé un problème de cohérence sur l'attribution par clic seul : si l'achat se fait avec un email différent de celui de réception, la conversion est comptée sur le destinataire d'origine alors que la commande (et donc la LTV) atterrit sur un autre `client_id` — un décalage entre stats campagne et fiche client, réconciliable seulement via une fusion de doublon manuelle. **Décision (Jake) : privilégier la cohérence des stats sur l'exhaustivité.** Condition finale dans le webhook Stripe : la conversion n'est comptée que si (1) un clic récent sur la campagne est prouvé (cookie `mp_click`) **ET** (2) le `client_id` réellement utilisé pour l'achat correspond exactement au destinataire du clic. Un clic suivi d'un achat avec une autre adresse n'est donc plus compté — compromis assumé pour que toute conversion affichée soit toujours traçable jusqu'à la commande correspondante sur la bonne fiche client. |
| 2026-07-03 | Marketing (11d Phase 4) — 4.4 Éditeur de templates ✅ | Composant partagé `BlocEditor.tsx` (`app/dashboard/business/marketing/_components/`) : éditeur "Canva simplifié" 2 colonnes inspiré de l'UX Brevo (calibré avec Jake sur capture d'écran) — palette de blocs à gauche qui bascule vers les réglages du bloc sélectionné (pas de 3e colonne fixe, pas de drag-and-drop, boutons ↑/↓/supprimer), texte édité inline sur le canvas, canvas fidèle au rendu email réel (mêmes couleurs/styles que `lib/email-blocs.ts`). Bouton "Aperçu" : nouveau helper `_lib/apercu.ts` (`construireApercu`) réutilise `rendreEmailHtml()` pour un rendu HTML fidèle affiché dans une iframe. **Bibliothèque** : page `/marketing/templates` (officiels lecture seule + dupliquer, perso créer/modifier/supprimer) + pages `/templates/nouveau` et `/templates/[id]` branchées sur `BlocEditor`. **Le vrai trou comblé** : le wizard de campagne ne permettait de choisir un template que tel quel (contenu copié brut dans `campagnes.contenu` sans jamais pouvoir le modifier) — nouvelle page `/marketing/campagnes/[id]/editer` (même `BlocEditor`) + bouton "Éditer le contenu" sur les brouillons/planifiées dans `CampagnesClient.tsx`. Refactor : constantes catégories (`CATEGORIE_LABEL`/`CATEGORIE_CLS`) extraites dans `_lib/categories.ts`, réutilisées par le wizard et la bibliothèque. **Itérations post-tests Jake (même journée)** : aperçu avec un vrai client sélectionné (remplace les tokens via `remplacerTokens()`, `_lib/contactsApercu.ts`) + toggle Bureau/Mobile dans la modale ; puis déplacement du sélecteur de client dans la modale elle-même (pas compris à côté du bouton) + recherche par nom/email. **Checklist de tests bout en bout passée avec Jake (19 points : bibliothèque, éditeur de blocs, personnalisation de campagne, non-régression)** — tout validé sauf un point de protection serveur (accès direct à l'éditeur d'une campagne déjà envoyée) non testable depuis l'UI normale, vérifié par relecture de code. **4.4 done.** Dans la foulée, Jake a aussi retesté 4.6 (désinscription, jamais reformellement vérifiée depuis son implémentation) : envoi d'une campagne test à lui-même, clic sur "Se désinscrire", statut désinscrit visible sur la fiche contact, compteur "Désinscrits" incrémenté sur la campagne, re-clic sur le même lien sans double comptage (idempotent), exclusion confirmée du ciblage d'une nouvelle campagne sur le même segment/liste. **4.6 reconfirmée fonctionnelle.** Deux bonus CRM ensuite : bouton manuel Inscrire/Désinscrire sur la fiche contact (pour tester sans vrai envoi) + vraies stats d'engagement newsletter par contact (conservées après désinscription, remplace les placeholders jamais branchés). Enfin, l'onglet "Newsletter" verrouillé de la vue Contacts (placeholder 🔒 depuis la Phase 0 du 11d) a été construit pour de vrai à partir de la maquette crm-proto : KPIs, segmentation par engagement, filtres, sélection + ajout à une liste — mêmes principes de conservation d'historique. **Reste 4.5 (vrai domaine d'envoi par boutique) — 4.8 (tests bout en bout formels du reste de la Phase 4) à confirmer avec Jake si les sessions du 2026-07-03 la couvrent déjà en partie.** |
| 2026-07-03 | Marketing — Variables enrichies + éditeur en pastilles cliquables ✅ | Deux itérations sur les variables de personnalisation le même jour. **1)** Retour "trop peu de variables" (3 dispo) : `remplacerTokens()` passe à ~25 tokens (identité, achats/fidélité, abonnement, préférences musicales étendues, réseaux sociaux, engagement, date), tous tirés de `ContactEnrichi` déjà chargé (aucune requête de plus). **2)** Retour sur l'UX : Jake a montré des captures de l'éditeur Brevo (variable = pastille cliquable inline dans le texte, config de secours en chaîne variable→variable→texte fixe) — a précisé vouloir un **constructeur visuel par menus**, pas de syntaxe brute à taper (public non technique). Nouveau composant `ChampAvecVariables.tsx` : éditeur `contentEditable` remplaçant les champs simples sur les 6 zones de texte de `BlocEditor` (titre en-tête, texte, titre/sous-titre section beats, description code promo, texte CTA) — cliquer une variable dans la palette l'insère au curseur en pastille cliquable, cliquer la pastille ouvre une modale pour construire la chaîne de secours par menus déroulants. Sérialise en `{{var}}` / `{{var\|secours1\|secours2\|texte fixe}}`, rétrocompatible. `remplacerTokens()` résout la chaîne complète côté envoi. **Testé en navigateur isolé** (page jetable + Playwright, supprimée après) : frappe, insertion, chaîne à 2 étapes, suppression — tout fonctionne, 0 erreur console. **Incident** : le serveur de test isolé a été lancé par erreur dans le même dossier que le serveur de Jake (cache `.next` partagé) → ses routes protégées ont temporairement renvoyé 404 au lieu de rediriger. Résolu (cache supprimé, serveur relancé proprement) — leçon retenue en mémoire pour ne plus reproduire. |
| 2026-07-03 | Marketing — Fix insertion de variable après désélection ✅ | Jake a testé le nouvel éditeur en pastilles : clic sur une variable → "✓ inséré" affiché, mais rien ne s'insérait dans le texte. **Cause** : `ChampAvecVariables` n'était monté que lorsque le bloc était sélectionné (rendu conditionnel select/lecture-seule dans `BlocCanvas`) — désélectionner un bloc démontait donc son champ, et la référence que la palette gardait vers "le dernier champ actif" devenait orpheline ; l'insertion échouait en silence sans que la confirmation optimiste ("inséré") ne le détecte. **Fix** : `ChampAvecVariables` reste désormais toujours monté, avec un nouveau prop `editable` qui bascule juste le mode lecture seule (pastilles visibles mais non cliquables, pas de `stopPropagation`) au lieu de démonter/remonter deux JSX différents. Bonus : le retour réel de l'insertion (`insere`/`copie`) pilote maintenant le message affiché dans la palette. **Vérifié dans une appli Next.js jetable entièrement isolée** (dossier séparé dans le scratchpad, `node_modules` du vrai projet relié en jonction lecture seule, aucun `.next` partagé — leçon de l'incident précédent appliquée) : le bug était bien reproductible hors du fix, et confirmé résolu après. Confirmé fonctionnel par Jake en conditions réelles. |
| 2026-07-04 | Session de planification (pas de code) — Naming + Phase 5 repensée + Commerce 2b | **Naming :** brainstorm long sur un possible changement de nom "My Producer" (pas définitif pour Jake). Rejeté : pattern "my+métier" (daté) et "beat+mot" (saturé par la concurrence). Direction "premium"/francophone (Maison, Atelier, Aria) la mieux reçue, rien de tranché. **Décision : reporté à l'étape 17**, coût de renommage vérifié bas dans le code (texte d'affichage + config uniquement — détail `memory/project_naming_deferred.md`). **Phase 5 Automatisations entièrement repensée** : Jake a fourni ses 5 vrais workflows email (texte exact) de sa propre boutique plutôt que les 4 recettes génériques prévues. Liste finale : 8 workflows (bienvenue abo, abo en attente, churn perso, remerciement achat à 4 paliers + variable singulier/pluriel, bienvenue perso avec règle de suppression, relance inactivité, follow-up free download, follow-up favori). Méthode de construction actée : workflows seuls d'abord → combinaisons ensuite → IA seulement pour les cas rares/anecdotiques (avec validation humaine avant envoi, notification email+badge, pas de péremption de brouillon — re-rendu à chaque ouverture pour la référence temporelle). Détail complet : `memory/project_phase5_automatisations_redesign.md`. **Nouveau chantier Commerce identifié comme prioritaire** : en creusant le workflow "tentative d'achat échouée", découverte que la page Commandes n'a jamais tracké aucun paiement échoué/panier abandonné (`commandes.statut` toujours écrit en dur à `payee`, vérifié dans le webhook). Décision : nouvelle table `tentatives_paiement` séparée (modèle Shopify Checkout≠Order), sans toucher à `commandes` (contraintes NOT NULL + référencée partout en Analytics/CRM/Codes promo). Détail : `memory/project_commerce_tentatives_paiement.md`. **Prochaine session : Phase 2b (Commerce) en premier, puis reprendre les 8 workflows Phase 5 en isolation.** |
| 2026-07-08 | Marketing — Logs emails (bonus, session non planifiée) ✅ | **Déclencheur :** en testant les automatisations (Phase 5), Jake n'avait aucun moyen de vérifier qu'un email était réellement parti — aucun historique unifié n'existait (le transactionnel de `lib/emails.ts` n'était loggé nulle part, campagnes et automatisations avaient chacune leur propre table de log incomplète et séparée). **Architecture retenue, pensée pour absorber les futurs points d'envoi sans effort supplémentaire :** nouvelle table `email_logs` + point de passage unique `lib/email-logger.ts` (`envoyerEmailUnique`/`envoyerLotEmails`) — tout futur email (nouveau transactionnel, nouvelle recette Phase 5) n'a qu'un seul appel à faire pour être automatiquement loggé, pas besoin de s'en souvenir à chaque fois. Branché sur les 6 points d'envoi jusque-là invisibles : les 4 fonctions de `lib/emails.ts` (invitation collab, fonds en attente, rappel, confirmation expiration), le renvoi de fichiers de commande, et le téléchargement gratuit. **Décision (validée avec Jake) : les campagnes sont volontairement exclues** de ce nouvel historique — leur détail par destinataire existe déjà dans `campagne_envois` et s'affiche sur la page Campagnes ; le dupliquer aurait noyé la liste sous des milliers de lignes à chaque envoi de masse (segment de 2000 clients = 2000 lignes). **Page `/dashboard/business/marketing/logs`** (nouvelle entrée sidebar Marketing) inspirée de WP Mail Logging : onglets Tous/Réussis/Échoués avec compteurs réels, recherche par portée sélectionnable Destinataire/Sujet/Message (bloc façon WordPress), pagination **serveur** (contrairement au pattern "fetch 500 + filtre client" utilisé ailleurs dans Business — décision volontaire car cette table grossit sans limite, contrairement aux commandes/segments qui sont bornés). **Contenu réel de l'email capturé** (`corps_html`/`corps_texte`) et affiché en aperçu rendu dans une iframe sandboxée depuis la modale de détail (le code source brut a été retiré à la demande de Jake, l'aperçu visuel suffit) — ne couvre que les emails envoyés après cette migration, rien de rétroactif. **Bouton Renvoyer** (icône dans le tableau + modale) : réutilise le contenu déjà stocké pour renvoyer le même email au même destinataire en un clic, si le client ne l'a pas vu ou si l'envoi a échoué — crée une nouvelle ligne de log comme n'importe quel envoi, absent si le contenu n'a pas été historisé. **Colonne Erreur en langage naturel** (`lib/email-erreurs.ts`) : traduit le JSON brut de Resend (ex. `invalid_parameter: email is not valid in to`) en explication compréhensible par un non-développeur avec une piste d'action concrète (ex. *"L'adresse email du destinataire est invalide, probablement une faute de frappe — vérifie son adresse et propose-lui de la corriger"*), visible directement dans le tableau et dans la modale, plutôt que le JSON technique. Deux migrations SQL exécutées par Jake : `supabase/email_logs_migration.sql`, `supabase/email_logs_corps_migration.sql`. **Testé et validé bout en bout par Jake** : automatisation visible dans les logs, aperçu du contenu fonctionnel, renvoi manuel fonctionnel. **Ne change rien au plan** — prochaine session : les 6 workflows Phase 5 restants (Churn message perso, Remerciement achat 4 paliers, Bienvenue perso, Relance inactivité, Follow-up free download, Follow-up favori). |
| 2026-07-14/16 | Phase 5.7 Combinaisons ✅ codée + testée en partie — Connexion auto à l'abonnement ✅ (bonus non planifié) | **Phase 5.7** : revue exhaustive des 21 scénarios de combinaison entre les 7 workflows Automatisations, tranchés un par un avec Jake (`docs/automatisations/combinaisons-5.7.md`), puis codés en autonomie. `lib/automatisations.ts` restructuré en résolution par jour/client à 2 passes. 2 variantes de la seule vraie combo (`combo_1er_achat_bienvenue_abo`/`combo_achat_recurrent_bienvenue_abo`, ton différent selon le palier). Aucun cas rare identifié → **Phase 5.8 (IA) abandonnée**, pas de cas d'usage réel. Bouton "Tout activer" + signature d'email personnalisable (`{{signature}}`) ajoutés en cours de route (demande Jake). File d'attente affichée déjà résolue (1 ligne par jour/client, pas par événement brut). **Test 1 validé** (combo achat+abonnement) ; reste les scénarios 2-17 de la checklist à tester. **Bonus non planifié, déclenché par un bug remonté pendant les tests** : un client qui s'abonnait restait "invité" (aucun vrai compte créé). Trouvé et corrigé : (1) `lierCompteClient()` oubliait de réassigner la moitié des tables référençant `clients.id` avant fusion de compte (silencieux avant, maintenant explicite et complet) ; (2) course structurelle (pas rare) entre les webhooks Stripe `checkout.session.completed`/`invoice.payment_succeeded` et la fusion de compte déclenchée par la redirection navigateur — résolue par une fonction Postgres atomique avec verrou (`supabase/fusionner_compte_client.sql`), les tentatives espacées en JS n'ont jamais suffi ; (3) connexion automatique construite en 3 itérations (lien magique verifyOtp serveur → échoue ; lien de récupération via `/auth/callback` PKCE → échoue, pas de code_verifier sur un lien généré côté admin ; **verifyOtp(token_hash) côté navigateur, réutilisant le pattern déjà éprouvé de `/nouveau-mot-de-passe`** → fonctionne). Décision produit : page "définis ton mot de passe" immédiate après l'abonnement plutôt qu'un email différé (garantit un vrai mot de passe défini, pas de risque que le client ne clique jamais). Testé et validé bout en bout par Jake (abonnement → mot de passe → connecté → déconnexion/reconnexion normale). Détail complet : `memory/project_connexion_auto_abonnement.md`. Trou connexe non traité : `/artiste/mot-de-passe-oublie` n'existe pas (lien mort). **Prochaine session : reprendre les tests 5.9 restants de Phase 5.7.** |
| 2026-07-23 | Étape 5v2 — Finitions mobile + panneau player déplié + déclinaison Blanche mise à jour | **Corrections mobile** (allers-retours captures annotées + `dev-browser`) : bordure de sélection de cover coupée (padding-top `.shop-row` insuffisant), rythme vertical entre sections resserré (margin-bottom section 30→24px, titre 18→8px), bug d'étirement rangée "type beats" (nom 2 lignes "Central Cee" étirait toute la rangée — `align-items:flex-start` + ellipsis). **Zoom desktop 125% figé en dur** via `body:has(.shop-root){zoom:1.25}` (pas `transform:scale`, ne recalcule pas la mise en page) scopé `min-width:1280px` (déborde en dessous, testé). **Header mobile non-sticky** (`position:static`), plusieurs itérations sur les espaces (haut de page, hero→titre), **bug du bandeau noir trouvé et corrigé** (dégradé hero ne remontait pas assez haut une fois le header non-sticky, fond brut de `.shop-root` exposé — `margin-top` hero ajusté à -95px), lueur blanche ajoutée derrière le header. **Bug structurel carrousels** : le padding du container (16px) restait fixe pendant tout le scroll horizontal au lieu de faire partie de la zone défilante comme dans la maquette — `.shop-row` casse le padding du conteneur (`margin-inline` négatif) et le réapplique sur lui-même, 32px de largeur utile récupérés. **Nouveau panneau player mobile déplié** (handoff Jake) : cover 170px/favori/progression/shuffle-loop-prev-play-next/prix. Décisions tranchées : loop=repeat-one, shuffle=mélange persistant, ⏮/⏭ toujours circulaires y compris en fin de piste naturelle ("jamais laisser l'utilisateur dans le vide") — favori retiré de la barre repliée après coup. **Déclinaison Blanche & Noire** mise à jour (nouveau handoff) : contraste texte relevé (accessibilité AA), bordures relevées, gris des dégradés recalculés (dominante violette parasite retirée), bug `--style-card-text` jamais surchargé corrigé (texte blanc invisible sur cartes styles), ombres ajoutées, boutons header mobile inversés (pastilles noires), favori panneau déplié corrigé (dégradé invisible). Webhook Vercel manqué plusieurs fois (commit vide à chaque fois), vérification systématique post-déploiement via `dev-browser`. **Bug post-clôture trouvé par Jake** : boutons CTA illisibles (texte blanc sur fond blanc) sur le preset d'accent "Noir & blanc" (`#F2F2F2`, différent de la déclinaison complète Blanche) — `a.shop-cta` avait sa couleur codée en dur (`#fff` au lieu de `var(--ac-t)`) et `--ac-deep`/`--ac-soft` n'étaient jamais surchargés pour ce ton, la formule générale se résolvant mal sur un accent quasi achromatique. Piège plus profond que le cas "bleu" déjà connu : même `oklch(from <hex littéral>...)` se résout différemment une fois stocké dans une custom property et lu via `var()` (vérifié canvas vs élément réel) — corrigé en `rgb()` final déjà calculé, sans aucune formule relative (détail : `memory/feedback_oklch_custom_property_indirection.md`). |
| 2026-07-21 | Étape 5v2 — Resync boutique↔maquette via dev-browser (session longue, ~30 écarts corrigés) | **Méthode** : comparaison DOM/CSS directe entre la boutique live et la maquette Claude Design via `dev-browser` (deux onglets pilotés, mesures `getBoundingClientRect`/`getComputedStyle`, jamais d'estimation à l'œil) — première vraie application de cette méthode après plusieurs sessions basées sur des captures d'écran. **Desktop** : container 1360px→1280px uniforme, grille "Réservés/Nouveautés/Sélection" transformée de carrousel scrollable en vraie grille 5 colonnes fixe (`.shop-row--beats`), formule du halo hero resynchronisée sur le script source de la maquette, pill newsletter réintégrée, bug de minification trouvé (`backdrop-filter` supprimé par Lightning CSS quand déclaré avant le préfixe webkit), icônes header réalignées, player agrandi, écart hero→section ramené à 0 (cause réelle : wrapper `SuccessBanner` + padding résiduel, pas juste le padding du hero). **Mobile** (nouveau lien maquette mobile fourni par Jake) : 5 icônes de tab bar remplacées (mauvais tracés, dont "Abonnements" carrément la mauvaise icône), hero repositionné, bouton "Tout voir" mobile entièrement différent du desktop (flush droite, sans flèche, fond plein, 11px), tag/prix des covers réduits, mention "dès" retirée. **Bug de spécificité CSS récurrent** (`.shop-root a` qui écrase les couleurs de texte sur les `<a>`/descendants) trouvé et corrigé 4 fois sur des composants différents — détail `memory/feedback_css_specificity_shop_root_a.md`. **Couleur bleue du hero** : investigation en plusieurs manches avant la vraie cause — `oklch(from var(--ac) ...)` se résout différemment de la même formule sur un hex littéral dans le pipeline de rendu (confirmé par échantillonnage de pixels réels, pas par comparaison de texte CSS) ; fix définitif en `rgb()` littéral figé pour le preset bleu + suppression du PNG desktop devenu obsolète. **Deux bugs mal diagnostiqués deux fois chacun avant la vraie cause** (contour bleu au tap = outline de `:focus` non stylée, pas un problème de drag d'image ; écart nom/compteur sous les cartes Type beats = `gap` du flex parent appliqué aux enfants directs, pas la line-height) — détail méthodologique `memory/feedback_misdiagnosis_before_fresh_evidence.md`. **Bouton favori déplacé** des covers vers le player (desktop + mini mobile, décision produit hors maquette). **Incident déploiement Vercel récurrent** (webhook GitHub→Vercel manqué 3 fois, résolu par commit vide à chaque fois) — détail `memory/feedback_vercel_webhook_missing_deploy.md`. Tout vérifié déployé en fin de session, desktop et mobile. **Reste hors scope** : beat cadeau de fidélité (6.7, reporté depuis Phase 6). **Prochaine session : Jake va intégrer 2 nouvelles déclinaisons de couleur côté maquette Claude Design — à resynchroniser une fois fournies.** |
