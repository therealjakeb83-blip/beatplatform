# Passation — Rang 9f « Tests de sécurité avant l'audit externe » : démarrage

Date : 2026-11-17. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_LENTEUR_DASHBOARD_9E_2026-11-17.md` (rang 9e terminé).

## État en arrivant

- **Rang 9e (lenteur du dashboard) ✅ TERMINÉ** le 2026-11-17 (T0-T13, validé par Jake sur PC : « tout est beaucoup plus rapide »). Détail et tableau avant / après : `ROADMAP.md`, bloc « Rang 9e — Lenteur du dashboard » (juste après le chantier préremplissage) ; mémoire `project_lenteur_dashboard_2026_10_20.md`.
- **Reste du 9e : T10**, à vérifier EN DÉBUT de session : les tâches de nuit (crons `campagnes`, `automatisations`, `abonnements-impayes`, `scans-automatisations`, `plateforme-rappels`, `paiements-multi`, `domaines`) ont tourné sans erreur depuis Dublin le 18/11 :
  `npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects --since 24h --query 'requestPath:/api/cron*' --json -n 200` (puis `--query 'level:error'`). Cocher T10 dans `ROADMAP.md` avec le résultat.
- **Refonte UX/UI (rang 10)** : en attente de la version définitive du brand style guide du web designer (décision de Jake). Ne pas la commencer.

## Règles nouvelles du 9e (à respecter dans tout nouveau code)

- Fonctions Vercel à **Dublin `dub1`** (même région que Supabase eu-west-1). Pour défaire : Vercel → Settings → Functions → Function Region.
- Dans le dashboard, tout lien = `LienSurvol` (`app/dashboard/_navigation/LienSurvol.tsx`, préparé au survol), jamais `next/link` directement.
- Toute nouvelle page du dashboard a un écran d'attente squelette (`app/dashboard/_navigation/Squelettes.tsx`, blocs gris fixes, jamais de roue).
- « Qui est connecté » côté page = `utilisateurConnecte()` (`lib/session-serveur.ts`, `getUser` auprès de Supabase, partagé dans un affichage) — **ne pas remplacer par `getClaims`** (Jake : aucun changement de sécurité).
- Lectures indépendantes en `Promise.all` ; `parLots` limité à 6 paquets simultanés.
- Tout appel Supabase de `proxy.ts` = `avecTimeout(étape, …)` (`lib/avec-timeout.ts`) ; traces `[proxy] délai dépassé` / `[proxy] page de secours` dans les journaux.
- Page par page côté serveur (Contacts, Commandes, Segments) = APRÈS la refonte, en dernier (rang 12) ; tests de performance refaits avant le lancement (étape 17 (h)).

## Le chantier 9f (intention de Jake, à ne pas rouvrir)

**But** : trouver et corriger un maximum de failles de sécurité AVANT de mandater une entreprise de cybersécurité — « plus on trouvera de failles, plus mince sera la facture ».

**Méthode en 2 temps, dans cet ordre :**

1. **Jake énonce des failles potentielles**, une par une. Pour chacune, Claude vérifie lui-même dans le code (et en ligne si besoin, sans rien casser) si elle existe, ou si elle a déjà été corrigée, et répond en situation : présente / absente / déjà corrigée (avec la preuve : fichier, ligne, test fait). Une faille confirmée = signalée tout de suite et notée pour le correctif (« Faille trouvée = signalée et bloquée »).
2. **Diagnostic complet par Claude** : passer en revue tout le code soi-même, lister toutes les failles potentielles (gravité, scénario concret, correctif proposé), puis les régler **une par une** : une question à la fois, en situation, A/B + recommandation, checklist T0-TN avant de coder, feu vert de Jake (`/gocode`).

**Déjà connu, à revérifier en premier (`ROADMAP.md`, étape 17, paragraphe « BLOQUANT LANCEMENT » et points (a)-(j))** :
- fichiers payants (MP3 propre, WAV, stems, contrats, factures) dans un stockage R2 public avec des noms devinables ;
- table `beatmakers` lisible en entier par la clé publique (`beatmakers_select_public using (true)` + grant `anon`) ; beats « prive » lisibles (base ≠ `boutique_rls.sql`) — **attention** : le verrou des colonnes (`beatmakers_verrou_colonnes`, 2026-11-12) ne couvre que l'ÉCRITURE ;
- (a) types de fichiers à l'envoi ; (b) aucune limite d'appels (connexion, inscription, free download, newsletter, écoutes, paiement) ; (c) fausses écoutes / faux comptes ; (d) en-têtes de sécurité absents (clickjacking de la page de paiement) ; (e) API du dashboard joignables pendant la maintenance ; (f) admin reconnu par le slug ; (i) suppression de compte ; (j) un compte à la fois beatmaker et client.

**Déjà corrigé (ne pas recompter comme ouvert, mais revérifier qu'il tient)** : fiches clients par boutique + garde `clientsLiesABoutique` (9d), écriture de `leads` / `infos_paiement_compte` par la clé de service seulement, verrou des colonnes sensibles de `beatmakers`, fonctions SQL fermées au public (2026-11-12), routes sensibles en JSON seulement, cookie d'abonné signé, téléchargement protégé (`lib/telechargement-acces.ts`), liste blanche d'emails.

**Pistes du diagnostic complet (liste de départ, pas exhaustive)** : toutes les routes `app/api/**` (session vérifiée ? appartenance vérifiée ? `createAdminClient()` seulement après contrôle ?), actions serveur, RLS en base vs fichiers `supabase/*.sql`, grants `anon` / `authenticated`, webhooks Stripe (signature), crons (secret), URL présignées R2 (type, taille, dossier), redirections ouvertes (`next`, `redirect`, `retour`), injections (filtres `.or()` construits avec du texte saisi), XSS (`dangerouslySetInnerHTML`, emails HTML, éditeur de blocs), CSRF des actions sensibles, domaines perso / sous-domaines (prise de contrôle), jetons signés (désinscription, suivi de clic, maintenance), journaux qui contiendraient des données personnelles, dépendances (`npm audit`).

## Méthode attendue

- Code sur `main`, commit + push après chaque changement ; **toujours `npx tsc --noEmit -p . && … && git commit`**. Jake teste sur sonoo.app.
- SQL un par un : petit = dans le chat, gros = lien cliquable vers le fichier ; dire où cliquer (Supabase → SQL Editor → New query), ce qu'il doit voir, et une vérification à lancer dans un onglet séparé. Essayer d'abord sur PGlite (`.scratch/prem-T7-pglite.mjs`).
- Vérifications en ligne : sans jamais abîmer les données réelles ; lectures publiques avec la clé publique seulement si le classifieur l'accepte (le 2026-11-17, extraire la clé publique du site pour mesurer a été REFUSÉ : ne pas contourner, demander à Jake).
- Après chaque lot : tests autonomes (appels directs, dev-browser profil `domaine` = session jakeb-test + Admin, achats visiteur via `jakeb-test.sonoo.app`, journaux Vercel), valider ce qui est prouvé à 100 % par le code, reporter dans `ROADMAP.md`, deux listes « fait / validé » et « reste à tester » (étapes précises, noms des boutons, comment défaire).
- Piège de mesure dev-browser : `click()` fait ses vérifications ~1,5 s avant de cliquer ; pour chronométrer, capter l'événement `click` dans la page.

## Règles

- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord de Jake.
- Ne jamais réintroduire de donnée CRM ou de coordonnée de paiement dans `clients`.
- Les données de test restent jusqu'à l'étape 17.

## Données de test laissées le 2026-11-17 (ménage à l'étape 17)

- Achat visiteur `1a24fe08` (`nicojacob83+9e-visiteur@`, « Test Dublin », Memories WAV 60 €, facture `jakeb-test-65611126`) chez jakeb-test.
- Celles du chantier préremplissage (voir `ROADMAP.md`).
