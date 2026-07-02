# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Règle de début de session

Au début de chaque session (sauf si Jake dit explicitement de ne pas le faire), lire en profondeur avant de répondre :

- `C:\Users\nicoj\beatplatform` — le projet principal Next.js + Supabase
- `ROADMAP.md` — état d'avancement à jour, journal des sessions
- Les fichiers récemment modifiés (git log dans beatplatform)

Le module Business (`/dashboard/business/`) est entièrement migré (CRM, Commerce, Analytics) — il ne reste que la page d'accueil business et Marketing. `C:\Users\nicoj\crm-proto` (prototype UX mock data) ne sert plus de référence que pour ces deux morceaux restants ; ne pas y aller par défaut, seulement si le travail en cours concerne l'accueil business ou Marketing.

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
| Business | `/dashboard/business/**` | Beatmakers — CRM/Commerce/Analytics migrés, reste accueil + Marketing |

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

**RLS critique** : toutes les tables protégées. Utiliser `createAdminClient()` uniquement dans les Route Handlers qui valident manuellement l'identité. Voir `supabase/rls_policies.sql` et `supabase/boutique_rls.sql`.

**Règle Vercel DELETE** : ne jamais lire `request.json()` dans un handler DELETE — utiliser POST à la place (bug plateforme connu).

---

## Module Business (`/dashboard/business/`)

Pages **terminées** : contacts, segments, listes, doublons, commandes, abonnements, plans, beats, licences, codes-promo, collabs, analytics (7 onglets : ventes, abonnements, revenus, préférences, codes-promo, beats + page détail, vue d'ensemble).

Reste **à faire** : page d'accueil `/dashboard/business/` (actuellement un placeholder statique — voir Phase 4 dans `ROADMAP.md`) et le module Marketing (sidebar en 🔒, tables DB déjà créées, UI jamais commencée).

Détail de l'historique et des décisions d'architecture : `ROADMAP.md` (étape 11d).

---

## Conventions

- Nommage **français** partout : variables, colonnes SQL, noms de routes, libellés UI
- Composants React : PascalCase (`NouveauBeatClient.tsx`)
- Alias TypeScript : `@/*` → `./` (défini dans `tsconfig.json`)
- Pas de commentaires dans le code sauf si le WHY est non évident
