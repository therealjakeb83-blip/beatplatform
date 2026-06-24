# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Règle de début de session

Au début de chaque session (sauf si Jake dit explicitement de ne pas le faire), lire en profondeur les deux projets suivants avant de répondre :

- `C:\Users\nicoj\beatplatform` — le projet principal Next.js + Supabase
- `C:\Users\nicoj\crm-proto` — le prototype UX (mock data, zéro backend) qui sert de référence UI

Lire notamment :
- La structure des dossiers (`app/dashboard/business/` dans beatplatform, `app/` dans crm-proto)
- Les fichiers récemment modifiés (git log dans beatplatform)
- Les pages ComingSoon dans beatplatform → c'est là que se trouve le travail restant
- Les pages correspondantes dans crm-proto → c'est le design de référence à migrer

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
| Business | `/dashboard/business/**` | Beatmakers — module en cours |

Le dashboard se protège via `proxy.ts` (pas un vrai `middleware.ts` Next.js) — redirige `/dashboard` vers `/connexion` si non authentifié, et vérifie que l'user a une ligne dans `beatmakers`.

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

- `lib/resend.ts` — singleton Resend
- `lib/emails.ts` — fonctions : `envoyerInvitationCollab()`, `envoyerFondsEnAttente()`, `envoyerRappelFonds()`

### Contrats PDF

- `lib/contrat.ts` → `genererContratPdf()` — PDF-Lib, stocké en R2, lien dans `commandes.livraison_link`

---

## Base de données

Fichiers SQL dans `supabase/` (~34 fichiers) : `schema.sql`, `rls_policies.sql`, et des migrations thématiques.

Tables principales :

| Table | Rôle |
|-------|------|
| `beatmakers` | Comptes beatmakers (slug, stripe_account_id, tva_numero) |
| `beats` | Catalogue (mp3/wav URLs, tags styles/ambiances, statut) |
| `clients` | Comptes artistes/acheteurs globaux |
| `licences` | Modèles de licence par beatmaker |
| `commandes` | Achats (montant HT/TTC/TVA, splits_snapshot) |
| `beat_splits` | Splits de collab (pourcentage, statut actif/en_attente, expire_le) |
| `abonnements_boutique` | Plans d'abo par boutique (stripe_price_id) |
| `abonnements_clients` | Souscriptions artistes (stripe_subscription_id) |
| `licence_downloads` | Audit des téléchargements |
| `crm_clients` | Contacts CRM par beatmaker (statut prospect/client/lead) |
| `crm_segments` | Segments (criteria_json) |
| `crm_listes` / `crm_listes_contacts` | Listes de contacts |
| `crm_fusions` | Historique fusions doublons |

**RLS critique** : toutes les tables protégées. Utiliser `createAdminClient()` uniquement dans les Route Handlers qui valident manuellement l'identité. Voir `supabase/rls_policies.sql` et `supabase/boutique_rls.sql`.

**Règle Vercel DELETE** : ne jamais lire `request.json()` dans un handler DELETE — utiliser POST à la place (bug plateforme connu).

---

## Module Business (`/dashboard/business/`)

Pages **terminées** : contacts, segments, listes, doublons, commandes, abonnements.

Pages **ComingSoon** (travail restant) : `beats/`, `codes-promo/`, `licences/`, `plans/`, `collabs/`, `analytics/`.

Le design de référence pour ces pages est dans `C:\Users\nicoj\crm-proto`.

---

## Conventions

- Nommage **français** partout : variables, colonnes SQL, noms de routes, libellés UI
- Composants React : PascalCase (`NouveauBeatClient.tsx`)
- Alias TypeScript : `@/*` → `./` (défini dans `tsconfig.json`)
- Pas de commentaires dans le code sauf si le WHY est non évident
