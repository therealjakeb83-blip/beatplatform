# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Règle de début de session

Au début de chaque session (sauf si Jake dit explicitement de ne pas le faire), lire en profondeur avant de répondre :

- `C:\Users\nicoj\beatplatform` — le projet principal Next.js + Supabase
- `ROADMAP.md` — état d'avancement à jour, journal des sessions
- Les fichiers récemment modifiés (git log dans beatplatform)

Le module Business (`/dashboard/business/`) est entièrement migré (CRM, Commerce, Analytics). Marketing est fonctionnel de bout en bout : Campagnes + éditeur de templates par blocs (envoi, ciblage, tracking, désinscription, conversions, personnalisation) et Automatisations — 7 workflows validés en test réel, **plus les combinaisons entre workflows (Phase 5.7/5.9) entièrement testées et validées le 2026-07-16** (17/17 tests, voir `docs/automatisations/combinaisons-5.7.md` et `ROADMAP.md`). Préférences musicales par client désormais pondérées par signal (achat/free download/favori). **Mailing (Phase 6) validé le 2026-07-17** : 6 emails transactionnels temps réel (confirmation commande/abonnement, demande d'annulation, fin d'abonnement, confirmation de compte artiste, free download), page de réglages en accordéon avec aperçu en direct — reste 6.7 (beat cadeau de fidélité, reporté, 2 décisions produit encore ouvertes). **Catégories (Phase 7) + amorce Admin : testées et validées de bout en bout le 2026-07-20** (checklist T0-T19 à 100%, migration `supabase/phase7_categories.sql` exécutée) : table `categories` remplace les listes hardcodées de `BeatForm.tsx`. `/dashboard/business/categories/` (côté beatmaker : demande de certification, gestion de ses propres catégories) et `/dashboard/admin/categories/` (modération + gestion des catégories officielles, nouvelle zone `/dashboard/admin/` gardée par `estAdmin()` — voir `lib/admin.ts`) sont deux pages distinctes.

**Étape 5v2 (boutique publique `/[slug]/**`) en cours depuis le 2026-07-21** — plusieurs sessions de resync design (desktop puis mobile) contre une maquette Claude Design fournie par Jake, méthode systématique par mesure DOM/CSS directe via `dev-browser` (jamais à l'œil sur une capture). État au 2026-07-23 : rythme vertical mobile et carrousels horizontaux full-bleed corrigés, header mobile non-sticky, zoom desktop 125% figé en dur (`body:has(.shop-root){zoom:1.25}`, `min-width:1280px`), **nouveau panneau player mobile déplié** (tap sur la barre mini-player → cover 170px/favori/progression/shuffle+loop+prev+play+next/prix — `PlayerContext.tsx` : `isShuffled` mélange persistant, `loopOne` repeat-one, `next()`/`prev()` toujours circulaires y compris en fin de piste naturelle), déclinaison **Blanche & Noire** (thème clair, accent verrouillé noir, `data-accent-preset="blancNoir"`) à jour avec le dernier handoff. Reste hors scope : beat cadeau de fidélité (6.7).

**⚠️ Blocage roadmap confirmé (2026-07-16) : aucun nom/domaine définitif pour la plateforme** (`myproducer.com` indisponible) — bloque Phase 4.5 (domaine d'envoi email) et l'étape 17 (déploiement) uniquement, rien d'autre. Voir `ROADMAP.md`, section "Ordre de priorité actuel", pour l'ordre de traitement recommandé du reste : ~~Phase 6 (Mailing transactionnels)~~ ✅ → ~~Phase 7 (Catégories & Certification)~~ ✅ → **Étape 5v2 (boutique) 🔄 → étape 15 (Admin) → Phase 8 (accueil business) → étape 14 (Onboarding) → étape 16 (Tests & corrections)**, puis Phase 4.5/étape 17 une fois le nom tranché. `C:\Users\nicoj\crm-proto` (prototype UX mock data) ne sert plus de référence que pour l'accueil business (Phase 8) ; ne pas y aller par défaut.

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
