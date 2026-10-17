# Passation — Domaine personnalisé par boutique (rang 9c)

Date : 2026-10-17. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**.

## État en arrivant

- **Terminé les 16-17/10** : la plateforme s'appelle **Sonoo**. Nom, domaine `sonoo.app`, emails et stockage sont en place et testés. Source unique `lib/constantes.ts` (`NOM_PLATEFORME`, `URL_APP`, `DOMAINE_ENVOI_PLATEFORME`, `DOMAINE_ENVOI_BOUTIQUES`, `EMAIL_*`, `expediteurBoutique()`, `ETIQUETTE_STRIPE`) ; stockage R2 = espace `sonoo`, clé d'un fichier via `cleR2()` (`lib/r2.ts`). Détail : `ROADMAP.md` (blocs « Renommage Sonoo » et « Déménagement du stockage ») et la mémoire `project_naming_deferred.md`.
- **Prochain chantier, demandé par Jake en priorité avant la refonte boutique (rang 10)** : **rang 9c, domaine personnalisé par boutique**, par exemple `jakebmusic.com` au lieu de `sonoo.app/jakeb-test`. **Rien n'est codé.** À lire : `ROADMAP.md`, section « Détail — Domaine personnalisé par boutique », et la mémoire `project_domaine_perso_boutique.md`.

## Comment démarrer la session

1. Lire `CLAUDE.md`, ce fichier, la section ROADMAP ci-dessus, la mémoire `project_domaine_perso_boutique.md` et `git log`.
2. **Calibrer précisément les attentes de Jake** (skill grill-me, une question à la fois, avec ta recommandation à chaque question) AVANT de proposer un plan. Questions de départ :
   - domaine entier ou sous-domaine ? `jakebmusic.com` porte aujourd'hui le site WordPress ET les emails de Jake (`contact@jakebmusic.com`) ;
   - qui achète le domaine : le beatmaker apporte le sien, ou achat via Sonoo ?
   - réservé au plan payant ?
   - que devient `sonoo.app/ta-boutique` : redirection vers le domaine, ou les deux adresses actives ?
   - comptes clients : une connexion par domaine est-elle acceptable ?
   - le domaine d'envoi des emails au nom du beatmaker fait-il partie du chantier (option « domaine propre », Phase 4.5) ?
3. **Exposer ensuite clairement les difficultés, enjeux et conséquences**, en langage simple (Jake n'a aucune expérience du code) :
   - les sessions, les paniers et les cookies de téléchargement sont séparés par domaine : le « compte artiste global » ne suit plus automatiquement d'une boutique à l'autre ;
   - Supabase n'accepte pas « tous les domaines » en redirection de connexion : il faut ajouter chaque domaine, ou faire passer la connexion par sonoo.app ;
   - le nombre de domaines par projet Vercel est limité : vérifier l'offre « Vercel for Platforms » et l'API Domains ;
   - le beatmaker doit modifier ses DNS, donc il lui faut une assistance très claire ;
   - Apple Pay et Google Pay : il faut déclarer chaque domaine chez Stripe (`app/api/stripe/contexte-paiement` déclare aujourd'hui le domaine de `NEXT_PUBLIC_APP_URL`) ;
   - liens : 76 liens `/${slug}` dans 25 fichiers de `app/[slug]`, et 112 liens vers les boutiques ailleurs (emails, dashboard, lib) ;
   - référencement : une seule adresse officielle par boutique ;
   - coûts éventuels, à vérifier en séance.
4. Ensuite seulement : le plan des lots + la checklist T0-TN présentés AVANT de coder. Code sur `main`, Jake teste sur sonoo.app, Claude teste lui-même ce qu'il peut via `dev-browser` (voir la mémoire `reference_tests_achat_dev_browser`).

## Grosses étapes déjà proposées (≈ 25-40 h)

0. Calibrage.
1. Fondations : reconnaître la boutique d'après le domaine (`proxy.ts`), et des liens qui marchent avec ou sans `/slug`.
2. Brancher un domaine depuis le dashboard : API Vercel, DNS, vérification, HTTPS, retrait.
3. Connexion des clients, paiement, Apple Pay / Google Pay et téléchargements sur le domaine.
4. Liens sortants (emails) + SEO.
5. Test réel avec un domaine de Jake + cas limites.

## Restes connus, hors de ce chantier

Étape 17 (passage de Stripe en réel) : renommer le compte Stripe « My Producer » en Sonoo, remplir le nom public et le libellé de relevé bancaire, supprimer l'ancien espace R2 `myproducer-beats`, lever le verrou « liste blanche » des emails.
