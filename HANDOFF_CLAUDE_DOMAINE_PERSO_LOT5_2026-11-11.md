# Passation — Domaine personnalisé par boutique, lot 5

Date : 2026-11-11. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**, domaine de test **https://test.jakebmusic.com** (jakeb-test). Remplace `HANDOFF_CLAUDE_DOMAINE_PERSO_LOT4_2026-11-11.md`.

## État en arrivant

- Lots 1 à 4 clos. Lot 4 (T0-T22, 2026-11-11) :
  - les emails, campagnes et automatisations envoyés aux clients pointent vers le domaine actif ;
  - `sonoo.app/mon-compte` → domaine connecté ;
  - « Continuer avec Google » fonctionne sur sonoo.app et sur le domaine (iPhone compris) ;
  - adresse canonique, `robots.txt` et plans de site sont en place (indexation fermée).
- À lire :
  - `ROADMAP.md`, section « Détail — Domaine personnalisé par boutique » (13 décisions à ne pas rouvrir, plan des lots, checklists et résultats des lots 1 à 4) ;
  - la mémoire `project_domaine_perso_grillme_2026_11_10.md`.
- Le lot 5 n'a pas encore de checklist : la présenter (T0-TN) à Jake avant de coder.

## Périmètre du lot 5 (fin de parcours)

- **Décision 5 (à ne pas rouvrir)** :
  - abonnement plateforme arrêté → le domaine affiche « Cette boutique est temporairement indisponible » (pas de 404, pas de redirection) ;
  - domaine conservé 30 jours : un réabonnement le remet en service automatiquement ;
  - ensuite, domaine libéré chez Vercel ;
  - date limite affichée au dashboard + mention dans l'email de fin d'abonnement.
- **Message noté au lot 4** : un domaine dont la boutique n'existe plus publiquement (404 ou sans abonnement) doit afficher le message ci-dessus.
- **Test du domaine entier** (décision 2) : Jake achète un domaine à bas prix, le branche en domaine entier (+ `www` qui redirige), et on l'abandonne après les tests.
- **Cas limites** : domaine retiré, expiré ou mal réglé, boutique suspendue par l'admin, plan non payé.
- **Fin du chantier** :
  - retirer la ligne CNAME `test` chez GoDaddy (par renommage si la suppression bloque) ;
  - relever le DNS de `jakebmusic.com` avant et après.

## Ce que le lot 4 a posé (à réutiliser)

- `lib/adresse-boutique.ts` :
  - `adresseBoutique(slug, domaine)` / `adresseDeLaBoutique(beatmakerId, slug)` → `{ site, accueil }` (domaine actif, sinon `sonoo.app` + `/slug`) ;
  - `chargerBrandingBoutique` (`lib/email-blocs.ts`) les fournit aux campagnes et aux automatisations.
- Suivi de clic (`/api/marketing/clic`) : destination acceptée = sonoo.app ou le domaine actif de la boutique du jeton.
- Passage inverse : `POST /api/artiste/passage-boutique` (slug + chemin) → laissez-passer à usage unique vers `domaine/artiste/passage?redirect=` (composant `LienVersBoutique`).
- Google :
  - `/api/artiste/google` → `/api/artiste/google/retour` sur sonoo.app (domaine de retour revérifié Actif, sinon reste sur sonoo.app) ;
  - email de bienvenue seulement pour une nouvelle fiche ;
  - le nom Google ne remplit qu'un prénom ou un nom vide.
- Référencement (`lib/referencement.ts`) :
  - `INDEXATION_OUVERTE` (absent = `Disallow: /` partout + `noindex`) ;
  - boutique référençable si visible et au moins 1 beat en vente ;
  - `domaine/sitemap.xml` (réécrit par `proxy.ts` vers `/{slug}/sitemap.xml`) ;
  - `sonoo.app/sitemap.xml` = sommaire des boutiques sans domaine.
- `lib/email-logger.ts` : une fiche client fusionnée pendant l'envoi est retrouvée par l'email (sinon `client_id` null), plus d'email absent des Logs.

## Pièges vus au lot 4

- Le journal d'un email peut disparaître si la fiche client change pendant l'envoi : corrigé, mais y penser pour tout nouvel email envoyé juste après une fusion de comptes.
- Logs Vercel : Claude les lit lui-même (mémoire `reference_logs_vercel_cli.md`), lecture seulement.
- Google en mode Test : seuls `jake@sonoo.app` et `contact@jakebmusic.com` peuvent se connecter (`therealjakeb83@gmail.com` n'est pas un compte Google).
- Projet Google en double `vivid-ocean-514415-g1` à supprimer un jour. Le bon projet est `sonoo-514415`.
- `sleep` est bloqué par le harnais : attendre dans le navigateur (`page.waitForTimeout`).

## Reporté à l'étape 17

- `INDEXATION_OUVERTE=true` sur Vercel.
- Validation de l'écran Google (passage en production).
- Custom Domain Supabase (option payante), pour que l'écran Google n'affiche plus `…supabase.co`.
- Comptes de test à nettoyer :
  - `jake@sonoo.app` et `contact@jakebmusic.com` (comptes artistes) ;
  - `nicojacob83+lot4-t1/t2/t4/t4b@` ;
  - ceux des lots précédents.
- Point (j) : rôles et adresses de connexion (un beatmaker ne doit pas pouvoir acheter dans sa propre boutique), « on verra plus tard » (Jake).

## Ensuite

Rang 9c bis : boutiques en sous-domaine `slug.sonoo.app`. À étudier avant de coder (DNS de sonoo.app, voir `ROADMAP.md`). Décidé par Jake : juste après le lot 5, avant le lancement.

## Réglages en place, à ne pas défaire

- Vercel : `test.jakebmusic.com` est rattaché au projet.
- GoDaddy : CNAME `test` → `a21d5db196248aea.vercel-dns-017.com` sur `jakebmusic.com`.
- Relevé DNS de référence de `jakebmusic.com` : A 152.42.134.54, 5 MX Google, 5 TXT, 2 NS GoDaddy, identique après le lot 4.
- Supabase : fournisseur Google activé ; Redirect URLs avec sonoo.app.

## Méthode

- Coder sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
- Claude fait lui-même les tests possibles via `dev-browser` et valide ce qui est prouvé par le code.
- SQL et réglages donnés à Jake un par un, avec où cliquer.
- Aucun email réel hors de la liste blanche.
- Ne toucher ni au WordPress ni aux emails de `jakebmusic.com`, ni à `jakebmusic.com` lui-même, ni aux mentions Sonoo.
