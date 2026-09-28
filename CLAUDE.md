# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Règle de début de session

Au début de chaque session (sauf si Jake dit explicitement de ne pas le faire), lire en profondeur avant de répondre :

- `C:\Users\nicoj\beatplatform` — le projet principal Next.js + Supabase
- `ROADMAP.md` — état d'avancement à jour, journal des sessions
- Les fichiers récemment modifiés (git log dans beatplatform)

Le module Business (`/dashboard/business/`) est entièrement migré (CRM, Commerce, Analytics). Marketing est fonctionnel de bout en bout : Campagnes + éditeur de templates par blocs (envoi, ciblage, tracking, désinscription, conversions, personnalisation) et Automatisations — 7 workflows validés en test réel, **plus les combinaisons entre workflows (Phase 5.7/5.9) entièrement testées et validées le 2026-07-16** (17/17 tests, voir `docs/automatisations/combinaisons-5.7.md` et `ROADMAP.md`). Préférences musicales par client désormais pondérées par signal (achat/free download/favori). **Mailing (Phase 6) validé le 2026-07-17** : 6 emails transactionnels temps réel (confirmation commande/abonnement, demande d'annulation, fin d'abonnement, confirmation de compte artiste, free download), page de réglages en accordéon avec aperçu en direct — reste 6.7 (beat cadeau de fidélité, reporté, 2 décisions produit encore ouvertes). **Catégories (Phase 7) + amorce Admin : testées et validées de bout en bout le 2026-07-20** (checklist T0-T19 à 100%, migration `supabase/phase7_categories.sql` exécutée) : table `categories` remplace les listes hardcodées de `BeatForm.tsx`. `/dashboard/business/categories/` (côté beatmaker : demande de certification, gestion de ses propres catégories) et `/dashboard/admin/categories/` (modération + gestion des catégories officielles, nouvelle zone `/dashboard/admin/` gardée par `estAdmin()` — voir `lib/admin.ts`) sont deux pages distinctes.

**Étape 5v2 (boutique publique `/[slug]/**`) en cours depuis le 2026-07-21** — plusieurs sessions de resync design (desktop puis mobile) contre des maquettes fournies par Jake, méthode systématique par mesure DOM/CSS directe via `dev-browser` (jamais à l'œil sur une capture). État au 2026-07-26 : zoom desktop 125% figé en dur (`body:has(.shop-root){zoom:1.25}`, `min-width:1280px`), **nouveau panneau player mobile déplié** (tap sur la barre mini-player → cover 170px/favori/progression/shuffle+loop+prev+play+next/prix — `PlayerContext.tsx` : `isShuffled` mélange persistant, `loopOne` repeat-one, `next()`/`prev()` toujours circulaires y compris en fin de piste naturelle), déclinaison **Blanche & Noire** (thème clair, accent verrouillé noir, `data-accent-preset="blancNoir"`) à jour, **carrousel "Réservés aux membres" en boucle infinie** (`.members-marquee`, défilement continu sans réaction au survol), **bloc bas mobile façon Spotify** (`.shop-bottom-dock` : player en dégradé d'opacité + navbar transparente), **hero animé** (nappes `--g1`/`--g2` qui dérivent + fondu vers le fond de page), grilles Nouveautés/Sélection réalignées sur les blocs catégories (232px fixe desktop). Détail complet des deux derniers lots : mémoire `project_boutique_lots_v5_v6_juillet26`. **Header mobile — résolu le 2026-07-27** : après plusieurs sessions à traiter ça comme un bug de rendu (`sticky`→`fixed`→`overflow-x:clip`→GPU layer, tous vérifiés techniquement corrects mais sans effet sur le ressenti de Jake), le vrai besoin s'est révélé être l'inverse — `.shop-header-wrap` est repassé en `position:static` sur mobile (défile avec la page comme n'importe quel bloc, disparaît en scrollant), avec `.shop-hero { margin-top:-70px }` pour que le dégradé du hero remonte visuellement derrière le header transparent. Validé sur iPhone 13 Pro Max réel. Voir mémoire `feedback_requirement_restated_before_more_fixes` pour la leçon (reformuler le besoin avant d'enchaîner les correctifs). Reste hors scope : beat cadeau de fidélité (6.7), CGV/confidentialité/contact/mentions légales/plan de site déjà construits (`app/[slug]/cgv`, `/contact`, etc. — vérifié le 2026-07-24, ne pas les recompter comme manquants). **Panier (`CartDrawer.tsx`) aligné le 2026-09-18** sur les patterns de la nouvelle page de paiement custom `/paiement/[slug]` (chantier 9 bis, voir mémoire `project_paiement_custom_checkout`) : code promo dépliable, champ email affiché uniquement si le code l'exige, email du compte connecté transmis automatiquement (plus jamais redemandé), paiement express PC élargi pour tenir sur une ligne.

**Emails toujours en minuscule (convention permanente depuis le 2026-09-18)** — voir mémoire `feedback_emails_toujours_minuscule` : tout champ email, présent ou futur, doit être normalisé en minuscule à la saisie (`onChange`) et avant tout stockage/comparaison en base, via `lib/email.ts` (`normaliserEmail()`/`normaliserEmails()`). Trouvé en corrigeant un vrai bug de comparaison sensible à la casse sur la restriction email des codes promo, étendu par Jake à toute la plateforme. Migration `supabase/normaliser_emails_minuscule.sql` exécutée (données déjà en base normalisées, 1 doublon de compte client fusionné) — détail complet dans `memory/project_normalisation_email_2026_09_18.md`.

**Checkout — règles confirmées le 2026-09-16/18** — le compte artiste connecté prime pour le rattachement CRM et l'email de commande, même si un autre email est saisi dans le formulaire. La newsletter est appliquée uniquement après paiement réussi : `true` peut inscrire, `false` ne désinscrit jamais un client déjà inscrit, et un nouveau client non coché reste désinscrit. Les champs professionnels sont transactionnels : `commandes.acheteur_raison_sociale` et `commandes.acheteur_numero_tva` alimentent facture + détail de commande, sans enrichir `clients` ni utiliser de cookie custom. Sur mobile, ne pas réintroduire de blocage global du zoom : le pinch reste autorisé et seul le double-tap accidentel est limité via `touch-action: manipulation`.

**Téléchargement post-achat `/telechargement/[commandeId]` — protégé depuis le 2026-09-19 (chantier 9 bis, Phase 11)** : simple confirmation d'email (formulaire `VerificationGate`, pas de lien magique ni de code envoyé — décision de Jake, l'UUID de commande reste la vraie protection). Emails valides : celui de l'acheteur (repli sur `clients.email` via `client_id` quand `commandes.acheteur_email` est null, cas fréquent), ou celui du compte beatmaker vendeur. Accès direct sans rien taper : cookie `dl_{commandeId}` (posé par `/api/telechargement/lookup` juste après paiement, ou après confirmation email), client connecté correspondant, ou beatmaker vendeur connecté. Voir `lib/telechargement-acces.ts` et mémoire `project_grillme_9bis_synthese`.

**⚠️ Règle absolue pour les tests : jamais d'envoi d'email réel vers une adresse autre que celles de Jake** — `nicojacob83@gmail.com` (et toutes ses déclinaisons `+xxx`), `contact@jakebmusic.com`, `feedback.jakeb@gmail.com`, `therealjakeb83@gmail.com`. Les adresses de clients présentes en base (même sur un compte de test) peuvent appartenir à de vraies personnes : un email non sollicité les dérange et risque de nuire à la réputation d'envoi du domaine avant le lancement. Avant tout test qui pourrait déclencher un envoi (confirmation de commande, renvoi, campagne, automatisation...), vérifier le destinataire ; sinon ne pas exercer ce chemin. Voir mémoire `feedback_adresses_email_autorisees_tests`. **Depuis le 2026-09-28, un verrou code l'impose aussi** (`lib/email-liste-blanche.ts`, branché dans `lib/email-logger.ts`, seul point d'envoi Resend) : tout email hors liste est bloqué et tracé « échoue » dans les logs. **À faire sauter avant le lancement** (`EMAILS_ENVOI_LIBRE=true` sur Vercel, noté à l'étape 17 de `ROADMAP.md`). Les emails envoyés par Supabase lui-même (inscription artiste, mot de passe oublié) ne passent pas par ce verrou.

**Étape 15 (Admin) lot 1 — codé et testé bout en bout le 2026-07-24** : `/dashboard/admin/recherche` (multi-critères, 3 onglets Boutiques/Artistes/Commandes & Abonnements, pas de debounce — garde-fou de séquence à la place, voir `feedback_recherche_admin_debounce`), `/dashboard/admin/stripe-events` (log webhook), suspendre/réactiver une boutique avec pause en cascade Stripe (`lib/admin-boutiques.ts`) sur l'abonnement plateforme du beatmaker ET chaque abonnement artiste actif — `pause_collection`, réversible. Fiches boutique/client/commande/abonnement en admin. 3 bugs réels trouvés et corrigés en testant (détail dans `project_admin_etape15_scope`) : auto-suspension du compte admin (bloqué maintenant), webhook `customer.subscription.updated` qui écrasait le statut `'suspendu'`, `revalidatePath()` qui effaçait un rapport affiché à l'écran. Reste 15d (Analytics plateforme) et 15e (Mails transactionnels), repoussés après l'Étape 8b.

**Étape 8b (Abonnement plateforme, beatmaker → My Producer) — découverte + codée + testée le 2026-07-24** : ce système n'avait **jamais été construit** malgré la table `abonnements_plateforme` présente depuis le schéma d'origine (voir `project_abonnement_plateforme_decouverte`) — n'importe qui pouvait utiliser toute la plateforme sans payer. V1 minimale livrée : 1 plan (mensuel 49,99€ / annuel 499,90€), essai gratuit 14 jours + CB obligatoire, checkout Stripe direct (pas de Connect), page `/dashboard/abonnement`, portail Stripe. **Le blocage réel de l'accès dashboard si non abonné n'est PAS encore activé** — construit volontairement en deux temps pour éviter de reproduire l'incident d'auto-verrouillage du même jour ; c'est le prochain morceau à cadrer.

**Chantier 9 bis, Phase 13 (paiement réparti entre vendeurs) — EN COURS : grill-me terminé + lot 1 (moteur de paiement) codé, testé T0-T13 et clos le 2026-09-28 ; suite = lot 2 (page de paiement).** Lire EN PREMIER `memory/project_phase13_grillme_decisions_2026_09_28.md` (décisions + état), puis ROADMAP.md « Détail — Phase 13 ». Points à ne pas rouvrir : comptes Stripe créés avec `controller` (Stripe responsable des soldes négatifs, frais payés par le vendeur, Dashboard Express bêta — `lib/stripe-comptes.ts`) ; deux chemins (un vendeur = paiement habituel ; beat collab = moteur `lib/paiement-multi.ts`, carte seule, 0 € sur la plateforme, prouvé) ; **le prix affiché = toujours le prix débité** (total serveur `prix-panier` partout) ; remise jamais sous 1 € par vendeur **sauf beat offert** ; **beat offert = licence gratuite avec contrat, uniquement par code promo 100 % ou montant ≥ prix — JAMAIS le free download** (commande gratuite = lot 3) ; A gère remboursements ET litiges (lot 4, avoirs pour tous, encart litige aussi en solo) ; email « nouvelle vente » à chaque vendeur (pas les renouvellements). `PAIEMENT_MULTI_VENDEURS_DISPONIBLE = true` depuis le lot 1. Comptes de test recréés : jakeb-test `acct_1UKknwIP9xrZvZAd` (FR), nic-beat-2809 `acct_1UKl42EwKKNKrgaa` (BE) ; jakeb-test1…10 (copies pour l'aperçu des déclinaisons) volontairement sans compte Stripe. **SQL qui modifie : toujours filtre exact + SELECT de contrôle avant (jamais `LIKE 'slug%'`).**

**Chantier 9 bis, Phase 12 (modèle de collaboration) — ✅ TERMINÉE : cadrée les 19-21 septembre 2026, lots 1 à 4 codés et testés (21-28 septembre), tout est fusionné dans `main`** (lire EN PREMIER : `memory/project_phase12_grillme_decisions_2026_09_21.md` = journal complet des 22 questions et décisions finales, puis `memory/project_phase12_lot1_etat_2026_09_21.md`, `memory/project_phase12_lot2_etat_2026_09_22.md`, `memory/project_phase12_lot3_etat_2026_09_28.md`, `memory/project_phase12_lot4_etat_2026_09_28.md` ; plan des lots dans `ROADMAP.md`, section « Détail — Phase 12 »). Points à ne pas rouvrir : **Stripe multi-Direct-Charge retenu, PayPal écarté pour la V1** ; **l'argent ne transite jamais par un compte temporaire** (prouvé en mode test : 0 mouvement de solde plateforme) ; mandat B→A fusionné dans l'acceptation (un texte, une case) ; pas de renégociation de répartition ; chaque part ≥ 10 % et ≥ 1 € ; beat hors vente tant que tous n'ont pas accepté ; **un refus ne remet jamais le beat en vente tout seul** — invitation verrouillée en historique, A débloque explicitement (« Publier quand même » sur la liste des beats, ou ré-enregistrement de la fiche), décidé en 3 itérations au lot 3 ; « évincer » renommé « retirer le collaborateur » côté UI (texte seulement) ; une facture par vendeur + un seul contrat (A seul concédant et maître de la vente) ; tous les pays supportés par Stripe, droit français partout ; checklist « prêt à vendre » commune à A et B (vérifiée côté serveur, lot 2) ; plan Free = vrai plan ouvert à tous (définition complète = rang 15a de la roadmap) ; Stripe assume les soldes négatifs (à vérifier en Phase 13). **4 lots : (1) fondations + calculette des parts ✅, (2) « prêt à vendre » + plan Free ✅, (3) vie de la collaboration ✅, (4) feu vert/contrat/emails/Stripe ✅ (« prêt à vendre » stocké par beatmaker : un vendeur non éligible fait sortir le beat collab de la boutique ; interrupteur « ventes collab » laissé sur ON mais paiement bloqué par le double verrou `PAIEMENT_MULTI_VENDEURS_DISPONIBLE = false` jusqu'à la Phase 13 ; pré-remplissage de l'identité dans l'onboarding Stripe reporté à l'Étape 14). Facture « modèle libre » ✅ codée et testée le 2026-09-28 (modèle Français/Libre + mentions, figés sur la commande — voir `memory/project_facture_modele_libre_2026_09_28.md`). Suite : Phase 13 (en cours, voir paragraphe au-dessus). ⚠️ Bug hors lot trouvé en testant, à corriger juste avant l'étape 16b (tests de sécurité) : abonnement boutique payé mais jamais enregistré si l'acheteur est connecté en tant que beatmaker (voir étape 17 de `ROADMAP.md`).** **Jake teste toujours sur beatplatform.vercel.app (le site principal) : coder directement sur `main`, pas sur une branche** (le déploiement d'une branche est derrière la connexion Vercel, découvert au lot 4). Chaque lot vient avec sa checklist T0-TN présentée AVANT de coder. **Scripts Stripe de test : `node --env-file=.env.local <script>` lancé par Jake dans son terminal — la lecture de `.env.local` par Claude est refusée par le système, ne jamais la contourner.**

**⚠️ Blocage roadmap confirmé (2026-07-16) : aucun nom/domaine définitif pour la plateforme** (`myproducer.com` indisponible) — bloque Phase 4.5 (domaine d'envoi email) et l'étape 17 (déploiement) uniquement, rien d'autre. Voir `ROADMAP.md`, section "Ordre de priorité actuel" (révisée le 2026-07-24), pour l'ordre de traitement recommandé du reste : ~~Phase 6~~ ✅ → ~~Phase 7~~ ✅ → ~~Étape 15 lot 1 (Admin)~~ ✅ → **Étape 8b (blocage d'accès à cadrer) 🔄 → Étape 15 lot 2 (15d/15e) → Étape 5v2 (boutique) → Phase 8 (accueil business) → Étape 14 (Onboarding) → Étape 16 (Tests & corrections)**, puis Phase 4.5/étape 17 une fois le nom tranché. `C:\Users\nicoj\crm-proto` (prototype UX mock data) ne sert plus de référence que pour l'accueil business (Phase 8) ; ne pas y aller par défaut.

---

## Commandes

```bash
npm run dev      # Démarrer le serveur de développement (port 3000)
npm run build    # Build de production
npm run lint     # ESLint (Next.js config)
```

Aucun framework de test n'est configuré — pas de jest/vitest/playwright.

---

## Architecture

### Stack

- **Next.js 16 + React 19** — App Router, Server Components, Route Handlers
- **Supabase** — Auth, PostgreSQL, RLS
- **Cloudflare R2** — Stockage audio/image (compatible S3)
- **Stripe Connect** — Paiements beatmakers → artistes, splits collaborateurs
- **Resend** — Emails transactionnels
- **Tailwind CSS 4**

### Structure `app/`

Deux espaces utilisateur distincts :

| Espace | Routes | Utilisateur |
|--------|--------|-------------|
| Boutique publique | `/[slug]/**` | Artistes (acheteurs) |
| Dashboard | `/dashboard/**` | Beatmakers (vendeurs) |
| Business | `/dashboard/business/**` | Beatmakers — CRM/Commerce/Analytics/Marketing/Mailing fonctionnels, reste accueil |
| Admin | `/dashboard/admin/**` | Jake uniquement — amorce V1 minimaliste (Catégories), périmètre élargi prévu (support, boutiques, analytics plateforme...) |

Le dashboard se protège via `proxy.ts` (pas un vrai `middleware.ts` Next.js) — redirige `/dashboard` vers `/connexion` si non authentifié, et vérifie que l'user a une ligne dans `beatmakers`. `/dashboard/admin/**` a en plus son propre `layout.tsx` qui gate via `estAdmin()` (`lib/admin.ts`) — V1 temporaire, un seul admin identifié par **slug de boutique** (`jakeb-test`, pas par email — à remplacer par un vrai système de rôles à l'étape 15).

### Clients Supabase — 3 niveaux

```
utils/supabase/client.ts   → createBrowserClient()      — composants client
utils/supabase/server.ts   → createServerClient()       — Server Components + Route Handlers
utils/supabase/admin.ts    → createAdminClient()        — service role (contourner RLS)
```

Ne jamais utiliser `lib/supabase.ts` (déprecié).

### Stripe

- `lib/stripe.ts` — instance serveur (API version `2026-04-22.dahlia`)
- Webhooks : `/api/stripe/webhook` — gère `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.*`, `account.updated`
- Stripe Connect Express : les beatmakers ont un `stripe_account_id`; les fonds transitent par la plateforme

### Stockage fichiers (R2)

- Upload direct navigateur → R2 via URL pré-signée : `/api/upload/presigned`
- Colonnes dans `beats` : `mp3_tague_url`, `mp3_propre_url`, `wav_url`, `stems_url`, `image_url`
- `lib/r2.ts` — client S3 configuré pour l'endpoint R2

### Emails (Resend)

- `lib/resend.ts` — singleton Resend (instanciation paresseuse via `getResend()`)
- `lib/emails.ts` — emails de splits/collab (`envoyerInvitationCollab()`, `envoyerFondsEnAttente()`, `envoyerRappelFonds()`) **et** les 6 emails transactionnels Phase 6 (`confirmationCommande`, `confirmationAbonnement`, `confirmationDemandeAnnulation`, `annulationAbonnement`, `confirmationCompteArtiste`, `telechargementGratuit`) — branding par boutique (couleur/logo/signature dédiée/footer réseaux), titre+intro personnalisables par type via `templates_transactionnels`, fallback par défaut sinon. Icônes réseaux sociaux en PNG hébergées (`public/icons/`), jamais en SVG inline ni en data URI (Gmail strippe les deux à la réception)
- `lib/mailing.ts` — moteur des campagnes marketing : ciblage segment/liste/manuel, ~25 tokens de personnalisation avec secours en chaîne (`{{variable|variable2|texte fixe}}`, résolus par `remplacerTokens()`), jeton signé (désinscription + suivi de clic), envoi par lots
- `lib/email-blocs.ts` — rendu HTML des blocs d'un template de campagne (en-tête, texte, beats, code promo, CTA, espace)
- `app/dashboard/business/marketing/_components/BlocEditor.tsx` + `ChampAvecVariables.tsx` — éditeur de blocs partagé (templates + contenu de campagne) ; les variables s'insèrent comme des pastilles cliquables dans le texte (édition `contentEditable`, jamais de démontage du champ à la désélection — voir mémoire `feedback_isolated_test_server`/session du 2026-07-03 si un bug similaire réapparaît)

**Règle fire-and-forget email dans un webhook** : toujours `await` un envoi d'email déclenché en fin de handler (webhook Stripe, `/auth/callback`...) même avec `.catch()` pour ne pas faire échouer la requête — une promesse non attendue en toute dernière instruction risque d'être tuée par l'environnement serverless avant d'avoir fini (bug réel, Phase 6, 2026-07-17 : `confirmationDemandeAnnulation` ne partait jamais, sans aucune erreur).

### Contrats PDF

- `lib/contrat.ts` → `genererContratPdf()` — PDF-Lib, stocké en R2, lien dans `commandes.livraison_link`

---

## Base de données

Fichiers SQL dans `supabase/` (~34 fichiers) : `schema.sql`, `rls_policies.sql`, et des migrations thématiques.

Tables principales :

| Table | Rôle |
|-------|------|
| `beatmakers` | Comptes beatmakers (slug, stripe_account_id, tva_active/tva_taux) |
| `beats` | Catalogue (mp3/wav URLs, tags styles/ambiances, statut) |
| `clients` | Comptes artistes/acheteurs globaux (partagés entre boutiques) |
| `licences` | Modèles de licence par beatmaker (mp3/wav/stems/illimite/exclusive) |
| `leads` | Relation client↔boutique (source, conversion) — base du CRM |
| `commandes` | Achats (`prix_paye`/`reduction_montant` en **euros décimaux**, pas centimes) |
| `beat_splits` | Splits de collab par beat (pourcentage, email_invite) |
| `split_payments` | Paiements de splits (montant en **centimes**, statut transfere/en_attente) |
| `abonnements_boutique` | Abonnements artistes → boutique (prix en centimes, Stripe subscription) |
| `abonnements_plateforme` | Abonnements beatmaker → My Producer |
| `codes_promo` | Codes promo (type_remise panier/produit/abonnement, restrictions) |
| `licence_downloads` | Audit des téléchargements de licence |
| `beat_plays` | Écoutes trackées (seuil 30s, durée, pays, device, source) |
| `doublons_ignores` / `fusions_crm` | Détection doublons CRM — paires ignorées / historique fusions |
| `segments_crm` | Segments CRM (filtres ET/OU) |
| `listes_crm` / `listes_crm_contacts` | Listes de contacts CRM |
| `templates_transactionnels` | Titre/intro personnalisés par beatmaker et par type d'email transactionnel (Phase 6) |
| `categories` | Styles/ambiances/instruments/type_beat (Phase 7) — source plateforme (lecture seule) ou beatmaker (ajout libre, certifiable) |

**RLS critique** : toutes les tables protégées. Utiliser `createAdminClient()` uniquement dans les Route Handlers qui valident manuellement l'identité. Voir `supabase/rls_policies.sql` et `supabase/boutique_rls.sql`.

**Règle Vercel DELETE** : ne jamais lire `request.json()` dans un handler DELETE — utiliser POST à la place (bug plateforme connu).

---

## Module Business (`/dashboard/business/`)

Pages **terminées** : contacts (Tous/Clients/Leads/Newsletter — 4 onglets), segments, listes, doublons, commandes, abonnements, plans, beats, licences, codes-promo, collabs, analytics (7 onglets : ventes, abonnements, revenus, préférences, codes-promo, beats + page détail, vue d'ensemble), marketing/campagnes + marketing/templates (envoi, ciblage, tracking ouvertures/clics, désinscription, conversions, éditeur de blocs par variables — sidebar déverrouillée), marketing/automatisations (7 workflows validés en test réel — Bienvenue abonnement/perso, Abonnement en attente, Churn, Remerciement achat 4 paliers, Relance inactivité avec code promo auto, Follow-up free download — page organisée en catégories/sous-pages), mailing/transactionnels (6 emails temps réel, accordéon avec aperçu en direct — validé 2026-07-17, reste 6.7 beat cadeau fidélité), categories (4 onglets, demande de certification côté beatmaker — **codée 2026-07-17, pas encore testée, migration SQL pas exécutée**). Modération + gestion des catégories officielles déplacées vers `/dashboard/admin/categories/` (hors module Business).

Reste **à faire** : le vrai domaine d'envoi par boutique (Phase 4.5 — actuellement un domaine fixe codé en dur dans `lib/mailing.ts`), les tests bout en bout formels de Campagnes (Phase 4.8), les règles de combinaison entre workflows d'Automatisations et l'IA pour les cas rares (Phase 5.7/5.8), le beat cadeau de fidélité (Phase 6.7), les tests bout en bout de Catégories + Admin (Phase 7 + étape 15, migration `phase7_categories.sql` à exécuter d'abord — voir checklist complète dans `ROADMAP.md`), et la page d'accueil `/dashboard/business/` (Phase 8, placeholder statique, volontairement en dernier).

Détail de l'historique et des décisions d'architecture : `ROADMAP.md` (étape 11d).

---

## Conventions

- Nommage **français** partout : variables, colonnes SQL, noms de routes, libellés UI
- Composants React : PascalCase (`NouveauBeatClient.tsx`)
- Alias TypeScript : `@/*` → `./` (défini dans `tsconfig.json`)
- Pas de commentaires dans le code sauf si le WHY est non évident
