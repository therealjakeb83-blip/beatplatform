# Passation — Domaine personnalisé par boutique, lot 4

Date : 2026-11-11. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**, domaine de test **https://test.jakebmusic.com** (jakeb-test). Remplace `HANDOFF_CLAUDE_DOMAINE_PERSO_LOT3_2026-11-11.md`.

## État en arrivant

- Lots 1, 2 et 3 clos. Lot 3 (T0-T19, 2026-11-11) : sur le domaine d'une boutique, un client se connecte, s'inscrit, change son mot de passe, paie (carte, 3D Secure, collab, abonnement, Apple Pay), télécharge, et passe sur `sonoo.app/mon-compte` déjà connecté.
- À lire : `ROADMAP.md`, section « Détail — Domaine personnalisé par boutique » (13 décisions à ne pas rouvrir, plan des lots, checklists et résultats des lots 1 à 3) et la mémoire `project_domaine_perso_grillme_2026_11_10.md`.
- Le lot 4 n'a pas encore de checklist : la présenter (T0-TN) à Jake avant de coder.

## Périmètre du lot 4 (liens et Google)

- **Liens des emails des boutiques vers le domaine actif** : aujourd'hui tous en `URL_APP` (sonoo.app), qui redirige vers le domaine en GET (ça marche, mais pas l'adresse officielle). À changer : `lib/emails.ts` (confirmation de commande → `/telechargement/…`, confirmation d'abonnement → `/${slug}/mon-compte`, et les autres emails envoyés aux clients), `lib/mailing.ts` (`url_boutique`, liens de suivi et de désinscription), `lib/email-blocs.ts` (blocs beats et « Voir la boutique » des campagnes), automatisations. Aide déjà prête : `domaineActifDeLaBoutique(beatmakerId)` dans `lib/boutique-du-domaine.ts` (pas encore utilisée). Les emails aux **beatmakers** (`/dashboard…`) restent sur sonoo.app.
- **Passage inverse sonoo.app → domaine** (décision 2A de Jake au lot 3) : depuis `sonoo.app/mon-compte`, un clic vers une boutique à domaine arrive non connecté. Même mécanisme que le laissez-passer du lot 3 (`generateLink` magiclink + `/artiste/passage` sur le domaine), déclenché au clic seulement. Sert aussi à Google.
- **Connexion Google** (mémoire `project_google_oauth_scope.md`) : détour par sonoo.app (Supabase n'accepte pas un joker « tous les domaines »), puis retour sur le domaine par le passage inverse.
- **Adresse canonique, plan de site, robots** : aucun `sitemap`/`robots` dans `app/` aujourd'hui.

## Ce que le lot 3 a posé (à réutiliser)

- `proxy.ts` : sur un domaine, `avecSessionRafraichie` (session Supabase rafraîchie, seulement si un cookie `sb-` existe) ; `/paiement` réécrit vers `/paiement/{slug}`, `/paiement/{slug}` → 307 `/paiement`, autre slug → 404. `/artiste`, `/telechargement`, `/api`, `/auth` servis tels quels.
- `lib/boutique-du-domaine.ts` : `siteDeLaRequete(request)` / `siteDeLaPage()` → `{ origine, slugDomaine, surDomaine }` (lu sur l'en-tête `host`).
- `lib/domaine-boutique.ts` : `lienPaiement`, `lienConnexionArtiste`, `slugBoutiqueDuChemin`.
- Comptes clients : `/api/artiste/inscription`, `/api/artiste/mot-de-passe-oublie`, `/api/artiste/compte-confirme`, `/api/artiste/passage-compte` ; pages `/artiste/confirmation`, `/artiste/passage` ; `app/artiste/layout.tsx` donne la boutique du domaine aux pages `/artiste/*`. Les clients artistes ne passent plus par les emails de Supabase (seul « mot de passe oublié » des beatmakers les utilise encore). `/auth/callback` gardé pour les anciens liens.
- `envoyerEmailCompteArtiste` (`lib/emails.ts`) : au nom de la boutique de départ, au nom de Sonoo sinon ; **toujours enregistré sans boutique (`beatmaker_id` null) avec `token_hash=masque`** — ne jamais faire apparaître un lien de connexion dans les Logs emails d'un beatmaker. SQL `supabase/domaines_boutique_lot3.sql` exécuté. Garde-fou : 1 email du même type par minute et par adresse.
- Apple Pay / Google Pay : `lib/stripe-domaines-paiement.ts` (`assurerDomainePaiement`), appelé par `contexte-paiement` (seulement pour le domaine de CETTE boutique) et à l'activation d'un domaine (compte du vendeur + compte Sonoo). T8 : actif partout, aucun fichier à héberger.
- Téléchargement sur un domaine : seulement les commandes de la boutique (propriétaire ou part), sinon renvoi vers sonoo.app.

## Pièges vus au lot 3

- La carte Revolut du Wallet de Jake est refusée par Apple Pay partout (« Essayez avec une autre carte »), en amont de Sonoo : utiliser son autre carte pour les tests Apple Pay.
- dev-browser : pas d'`atob`, ni `ctx.request.get`, ni `headers()` sur une réponse d'API dans le bac à sable → décoder dans `page.evaluate`. Pour prouver un rafraîchissement de session par le serveur : bloquer `**/auth/v1/token**` côté navigateur.
- Les liens extraits d'une page (RSC) peuvent finir par un `\` parasite : nettoyer avant de les ouvrir.
- Seule jakeb-test est visible publiquement (admin, exemptée) ; les autres boutiques de test n'ont plus d'abonnement plateforme (404). `sonoo.app/jakeb-test` redirige vers le domaine : pour un achat témoin sur sonoo.app, remplir `localStorage['panier_jakeb-test']` puis ouvrir `sonoo.app/paiement/jakeb-test`.
- Comptes de test créés au lot 3 : `nicojacob83+lot3-abo@` (abonné PRO 6,99 € actif sur jakeb-test, mode test), `+lot3-t3@`, `+lot3-t7@` (comptes artistes). À nettoyer avec les données de démo à l'étape 17.

## Noté, hors lot

- Achat témoin « Gyro » (`ec5caf75`) : aucun fichier audio listé sur la page de téléchargement (contrat et facture présents), affichage non modifié par le lot 3 → sans doute un fichier manquant sur ce beat.
- Erreur React #418 au rechargement avec un panier rempli (notée au lot 1).

## Réglages en place, à ne pas défaire

- Vercel : `test.jakebmusic.com` au projet. GoDaddy : CNAME `test` → `a21d5db196248aea.vercel-dns-017.com` sur `jakebmusic.com`, à retirer à la fin du chantier (par renommage si la suppression bloque). Relevé DNS de référence de `jakebmusic.com` (A 152.42.134.54, 5 MX Google, 5 TXT, 2 NS GoDaddy) identique après le lot 3.

## Méthode

Coder sur `main`, commit + push après chaque changement, Jake teste sur sonoo.app. Claude fait lui-même les tests possibles via `dev-browser` (profils `lot3` / `lot3v` = visiteurs, `domaine` = session admin de Jake) et valide ce qui est prouvé par le code. SQL et réglages donnés à Jake un par un, avec où cliquer. Aucun email réel hors de la liste blanche. Ne toucher ni au WordPress ni aux emails de `jakebmusic.com`, ni à `jakebmusic.com` lui-même, ni aux mentions Sonoo.
