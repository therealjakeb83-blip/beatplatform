# Passation — Domaine personnalisé par boutique, lot 3

Date : 2026-11-11. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_DOMAINE_PERSO_LOT2_2026-11-10.md`.

## État en arrivant

- Lots 1 et 2 clos (lot 2 : T0-T22, le 2026-11-11). Un beatmaker branche, vérifie, change et retire son domaine depuis `/dashboard/domaine`. `test.jakebmusic.com` est Actif sur jakeb-test, et `sonoo.app/jakeb-test/...` y redirige (307).
- À lire : `ROADMAP.md`, section « Détail — Domaine personnalisé par boutique » (13 décisions à ne pas rouvrir, plan des lots, checklist du lot 2 avec ses résultats) et la mémoire `project_domaine_perso_grillme_2026_11_10.md`.
- Le lot 3 n'a pas encore de checklist : la présenter (T0-TN) à Jake avant de coder.

## Périmètre du lot 3 (compte et paiement)

Connexion, inscription, mot de passe (emails Sonoo avec lien vers le bon domaine, `admin.generateLink` + `verifyOtp`), retours Stripe, Apple Pay / Google Pay par compte vendeur, téléchargements, laissez-passer vers `sonoo.app/mon-compte`, paniers collab.

Restent à traiter (posés au lot 1) : sur un domaine, `/paiement`, `/telechargement`, `/artiste` et `/.well-known` ne sont pas réécrits. Liens encore au format d'origine : `SAbonnerButton`, `/paiement/${slug}` dans `CartDrawer`, `return_url` de `CartExpressPay`, `/artiste/connexion?redirect=/${slug}` (`BoutiqueHeader`, `FavoriButton`), `/api/artiste/deconnexion?redirect=/${slug}` (`mon-compte/page.tsx`). Stripe : `app/api/stripe/contexte-paiement` ne déclare que le domaine de `NEXT_PUBLIC_APP_URL` pour Apple/Google Pay ; chaque domaine doit être enregistré sur le compte connecté du vendeur.

**Important depuis le lot 2** : la redirection `sonoo.app/slug` → domaine est allumée (GET/HEAD seulement, jamais `/paiement`, `/dashboard`, `/api`, `/telechargement`…). Un client qui part d'une boutique à domaine actif arrive donc sur le domaine, où la connexion et le paiement ne marchent pas encore : c'est le cœur du lot 3. Aucun vrai paiement n'existe sur Sonoo, décision de Jake de l'allumer quand même.

## Ce que le lot 2 a posé

- **Base** : `supabase/domaines_boutique_lot2.sql` et `domaines_boutique_lot2b.sql` (exécutés). Colonnes : `domaine_entier`, `lignes_dns`, `explication`, `echecs_consecutifs`, `derniere_verification_le`, `premiere_activation_le`, `premier_echec_le`, `dernieres_verifications` (3 dernières). Emails Sonoo `domaine_actif`, `domaine_probleme`, `domaine_libere`.
- **Règles pures** `lib/domaine-regles.ts` : `normaliserDomaine`, `domaineInterdit`, `construireLignesDns`, `deciderStatut` (panne confirmée après **plus de 30 min** sans réponse depuis le premier échec, une réussite remet à zéro), `causeCourte`, `ajouterVerification`, `promptAssistantDns`.
- **API Vercel** `lib/vercel-domaines.ts` (variables `VERCEL_TOKEN_DOMAINES`, `VERCEL_PROJET` sur Vercel, en Secret). Toute panne ou clé invalide = `VercelIndisponible` → aucun statut modifié. Le retrait relit le domaine après coup et échoue s'il est encore là.
- **Serveur** `lib/domaines-boutique-serveur.ts` : `brancherDomaine` (base d'abord pour réserver, remise en état si Vercel refuse), `verifierDomaine` (sonde HTTPS `/api/domaine/sonde` répondue par `proxy.ts`), `retirerDomaine`, `domainesAVerifier`, `libererDomainesOublies` (30 jours en attente sans jamais avoir marché).
- **Routes** `app/api/domaine/{brancher,verifier,retirer}` (compte connecté uniquement, aucun identifiant reçu ; « verifier » = une seule vérification, 15 s minimum entre deux) et tâche `app/api/cron/domaines` toutes les 10 min (`vercel.json`).
- **`proxy.ts`** : `redirectionVersDomaine` (307, mémoire 30 s, toute erreur = pas de redirection).

## Pièges vus au lot 2

- Vercel met **10 à 20 min** à cesser de servir un domaine retiré, alors que son API confirme tout de suite. Pour vérifier en direct : `curl --resolve domaine:80:216.150.1.1 http://domaine/api/domaine/sonde` (`DEPLOYMENT_NOT_FOUND` = plus branché).
- GoDaddy refuse la suppression d'une ligne DNS, même après vérification d'identité : **renommer** la ligne marche (`test` → `test-pause` → `test`).
- La page Domaine ouverte relance une vérification toutes les 30 s quand le domaine n'est pas Actif ou a un échec en cours : la fermer pour prouver une action automatique.
- Le déploiement Vercel **sans cache** a échoué une fois sur la police Google Syne (`app/[slug]/layout.tsx`), cause non trouvée. Garder « Use existing Build Cache » coché.
- Jake doit se connecter dans la fenêtre Chrome pilotée par `dev-browser --browser domaine` (pas dans son Chrome habituel). jakeb-test est admin : il ne sert pas à tester le cadenas du plan Free.

## Réglages en place, à ne pas défaire

- Vercel : `test.jakebmusic.com` au projet. Domaines fictifs de test (`sonoo-essai-lot2-9c.com`, `beats.sonoo-essai-lot2-9c.fr`) retirés.
- GoDaddy : une seule ligne ajoutée sur `jakebmusic.com`, CNAME `test` → `a21d5db196248aea.vercel-dns-017.com`. À retirer à la fin du chantier (par renommage si la suppression bloque encore).
- Relevé DNS de référence de `jakebmusic.com` (A 152.42.134.54, 5 MX Google, 5 TXT, 2 NS GoDaddy) : identique après le lot 2.

## Méthode

Coder sur `main`, commit + push après chaque changement, Jake teste sur sonoo.app. Claude fait lui-même les tests possibles via `dev-browser` et valide ce qui est prouvé par le code (règle de Jake). SQL et réglages donnés à Jake un par un, avec où cliquer. Aucun email réel hors de la liste blanche. Ne toucher ni au WordPress ni aux emails de `jakebmusic.com`, ni à `jakebmusic.com` lui-même, ni aux mentions Sonoo.
