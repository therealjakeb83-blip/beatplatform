# Passation — Domaine personnalisé par boutique, lot 2

Date : 2026-11-10. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_DOMAINE_PERSO_LOT1_2026-11-10.md`.

## État en arrivant

- Lot 1 clos (T0-T10). `test.jakebmusic.com` affiche la boutique jakeb-test.
- À lire : `ROADMAP.md`, section « Détail — Domaine personnalisé par boutique » (13 décisions à ne pas rouvrir, plan des lots), et la mémoire `project_domaine_perso_grillme_2026_11_10.md`.
- Le lot 2 n'a pas encore de checklist : la présenter (T0-TN) à Jake avant de coder.

## Périmètre du lot 2

Brancher depuis le dashboard : API Vercel (Jake crée une clé d'accès), lignes à copier, prompt IA, statut, vérification automatique, emails, cadenas Free, retrait/changement, `www`, redirection `sonoo.app/slug` → domaine avec garde-fou.

## Ce que le lot 1 a posé

- **Table** `domaines_boutique` (`supabase/domaines_boutique.sql`) : `beatmaker_id` unique, `domaine` unique en minuscules, `statut` = `en_attente` / `actif` / `probleme`. Le beatmaker connecté peut seulement lire sa ligne ; les écritures passent par le serveur (`service_role`). Pas de déclencheur sur `updated_at`.
- **`proxy.ts`** : tout en haut, `estHotePlateforme()` ; hors plateforme, `reponseDomaineBoutique()`. Seul `statut = 'actif'` affiche la boutique. Mémoire de 30 s par instance : un changement de statut met jusqu'à ~30 s à s'appliquer.
- **`lib/domaine-boutique.ts`** : règles pures (`lienBoutique`, `routeSurDomaine`, listes de chemins). `DOMAINE_PLATEFORME` est dans `lib/constantes.ts`.
- **Liens** : `useLienBoutique(slug)` côté navigateur (`app/[slug]/_components/DomaineBoutique.tsx`), `await lienBoutiqueServeur(slug)` côté serveur (`app/[slug]/_lib/lien-boutique-serveur.ts`). Toute nouvelle page de boutique doit les utiliser. `revalidatePath` garde le chemin interne `/${slug}/...`.
- Côté serveur, « sur un domaine » = en-tête `host` hors plateforme (pas d'en-tête transmis par le proxy).

## Laissé volontairement pour le lot 3

Sur un domaine, `/paiement`, `/telechargement`, `/artiste` et `/.well-known` ne sont pas réécrits. Liens encore au format d'origine : `SAbonnerButton`, `/paiement/${slug}` dans `CartDrawer`, `return_url` de `CartExpressPay`, `/artiste/connexion?redirect=/${slug}` (`BoutiqueHeader`, `FavoriButton`), `/api/artiste/deconnexion?redirect=/${slug}` (`mon-compte/page.tsx`).

## Pièges vus au lot 1

- Suspendre par SQL : `suspendu_motif` obligatoire (contrainte), avec `suspendu_raison` si motif = `autre`.
- `jakeb-test1` n'existe plus en base ; `jakeb-test5` à `10` oui, sans compte Stripe.
- Erreur React #418 au rechargement avec un panier rempli, sur `sonoo.app` comme sur le domaine, sans effet visible : à traiter à part.
- Sur le domaine, un chemin inconnu à un seul niveau (ex. `/nic-beat-2809`) affiche la page 404 avec un statut HTTP 200 ; à deux niveaux, le statut est bien 404.

## Méthode

Coder sur `main`, commit + push après chaque changement, Jake teste sur sonoo.app. Claude fait lui-même les tests possibles via `dev-browser`. SQL et réglages donnés à Jake un par un, avec où cliquer. Aucun email réel hors de la liste blanche. Ne toucher ni au WordPress ni aux emails de `jakebmusic.com`, ni aux mentions Sonoo.
