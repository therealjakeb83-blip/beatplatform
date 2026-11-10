# Passation — Domaine personnalisé par boutique, lot 1

Date : 2026-11-10. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_DOMAINE_PERSO_2026-10-17.md`.

## État en arrivant

- Calibrage terminé (13 questions), plan en 5 lots et checklist du lot 1 validés par Jake. **Aucun code écrit.**
- À lire : `ROADMAP.md`, section « Détail — Domaine personnalisé par boutique » (décisions, faits vérifiés, lots, checklist T0-T10), et la mémoire `project_domaine_perso_grillme_2026_11_10.md`.
- Ne pas rouvrir les 13 décisions.
- Ordre ensuite : rang 9d (fiches clients confidentielles, à calibrer, bloquant lancement), rang 9e (lenteur du dashboard), refonte.
- Logo Sonoo de base reçu : ne pas l'intégrer avant la charte complète.

## Objectif du lot 1

`test.jakebmusic.com` affiche la boutique jakeb-test, sans `/jakeb-test` dans l'adresse, sans que `sonoo.app` change en quoi que ce soit. Connexion et paiement sur le domaine = lot 3, hors de ce lot.

## Pistes techniques (à vérifier dans le code au moment de coder)

- **Avant de coder** : lire `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (AGENTS.md).
- **Table** `domaines_boutique` : un domaine par boutique, domaine unique, statut. Migration en une transaction, GRANT `authenticated` et `service_role` séparés + policies, vérifier en base après exécution par Jake.
- **`proxy.ts`** : tout en haut, si le domaine demandé est `sonoo.app`, `www.sonoo.app`, `*.vercel.app` ou localhost, suivre exactement le chemin actuel, sans aucune requête de plus. Sinon, retrouver la boutique avec une courte mémoire de quelques instants, puis réécriture interne.
- **Chemins sur un domaine** :
  - `/x` → `/slug/x` en interne, donc `/autre-slug` ne peut jamais afficher une autre boutique (T6).
  - `/mon-compte` sur un domaine = l'espace client de la boutique, pas la page globale.
  - `/dashboard`, `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/nouveau-mot-de-passe`, `/confirmation-compte`, `/maintenance`, `/verification-en-cours` → redirection vers `sonoo.app` (T7).
  - `/api/*`, `/auth/*`, `/_next/*` non réécrits. `/paiement/[slug]`, `/telechargement/*` et `/artiste/*` restent à traiter au lot 3.
- **Assistant de liens unique** : 76 liens `/${slug}` dans 25 fichiers de `app/[slug]`. Même résultat qu'aujourd'hui sur sonoo.app, sans `/slug` sur un domaine. Serveur : information transmise par `proxy.ts`. Client : contexte React.
- **La redirection `sonoo.app/slug` → domaine n'est PAS au lot 1** (lot 2, avec le garde-fou).
- **Ne pas toucher aux mentions Sonoo** (décision 9).
- **Cookies** : ne jamais poser d'attribut `Domain`.

## Ce que Jake doit faire au lot 1

1. Exécuter le SQL dans l'éditeur Supabase (une requête de vérification séparée ensuite).
2. Chez GoDaddy, sur `jakebmusic.com` : ajouter la ligne CNAME `test` indiquée par Vercel. Ne toucher à aucune autre ligne.
3. Sur Vercel : ajouter `test.jakebmusic.com` au projet.

## Méthode

Coder sur `main`, commit + push après chaque changement, Jake teste sur sonoo.app. Claude fait lui-même T1 à T9 via `dev-browser`, T10 sur l'iPhone de Jake. Résultats reportés dans `ROADMAP.md`. Aucun email réel hors de la liste blanche.
