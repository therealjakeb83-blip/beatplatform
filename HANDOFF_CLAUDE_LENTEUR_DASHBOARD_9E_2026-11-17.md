# Passation — Rang 9e « Lenteur du dashboard » : diagnostic

Date : 2026-11-17. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_PREREMPLISSAGE_PAIEMENT_CADRAGE_2026-11-16.md` (chantier préremplissage terminé).

## État en arrivant

- **Rang 9d (fiches clients confidentielles) ✅ TERMINÉ** le 2026-11-16.
- **Chantier préremplissage du paiement ✅ TERMINÉ** le 2026-11-17 (T0-T18). Détail : `ROADMAP.md`, bloc « Chantier préremplissage du paiement » juste après le lot 5 du 9d ; mémoire `project_preremplissage_paiement_cadrage_2026_11_17.md`. Règles à respecter (dans `CLAUDE.md`) : préremplissage lu côté serveur pour un client connecté seulement ; infos du compte dans `infos_paiement_compte` uniquement, jamais dans `clients` ni `leads`.
- **Rang 9e (lenteur du dashboard)** : rien n'a encore été fait. Ordre décidé par Jake : 9e avant la refonte UX/UI (rang 10), sinon la refonte serait pénible à tester.

## Le problème (constaté par Jake le 2026-10-20)

Navigation dashboard très lente par moments ; la page `/verification-en-cours` (« Petit souci technique ») s'affiche souvent. Elle vient du chrono de 5 s de `proxy.ts` (voir mémoire `project_incident_supabase_timeout_proxy`). Les boutiques sont rapides (~0,5 s) et ne sont pas concernées.

Ce qui est établi (mémoire `project_lenteur_dashboard_2026_10_20.md`) :
- Supabase n'est pas saturé (CPU 2 %, connexions 17/60, plan gratuit).
- `getUser` prend 0,2 s en général, avec des pointes de 5-7 s.
- Les fonctions Vercel tournaient à Washington (`iad1`) le 20/10 ; aucune région réglée (ni `vercel.json`, ni `preferredRegion`). **À revérifier** : les journaux Vercel du 17/11 affichent `"region":"cdg1"` pour les fonctions (Paris), donc la région a peut-être changé depuis.
- Claude lit maintenant les journaux Vercel lui-même : `npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects --since 30m --query 'level:error'` (l'ancienne option `--level` est retirée).

## Ce qu'il faut faire en premier (diagnostic, pas de code avant le feu vert)

1. **Demander à Jake la région de sa base Supabase** (Project Settings → General → Region). C'est une attente déjà listée sur sa page « Où on en est ».
2. **Mesurer** :
   - région réelle des fonctions (`x-vercel-id`, et le champ `region` des journaux) ;
   - temps des appels `proxy.ts` (session, vérification beatmaker) ;
   - quelles pages du dashboard sont lentes ;
   - préchargement des liens.
3. **Proposer** : ajouter un `console.warn` dans `proxy.ts` quand un appel dépasse le chrono (étape + durée), parce qu'aujourd'hui `/verification-en-cours` ne laisse aucune trace dans les journaux.
4. Présenter ensuite à Jake les pistes (une question à la fois, en situation, avec la comparaison Shopify si elle a du sens, A/B + recommandation) :
   - même région Vercel que Supabase (réglage sans code, plan Pro) ;
   - alléger les pages lourdes (Analytics) ;
   - limiter le préchargement ;
   - Supabase payant.
5. Puis la checklist T0-TN. **Ne rien coder avant le feu vert de Jake** (il lancera `/gocode`).

## Méthode attendue

- Code sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
- **Toujours `npx tsc --noEmit -p . && … && git commit`.** Le 17/11, un enchaînement avec `;` a poussé un fichier qui ne compilait pas.
- SQL un par un : petit = dans le chat, gros = lien cliquable vers le fichier ; dire où cliquer, et donner une vérification à lancer dans un onglet séparé. Essayer d'abord sur PGlite (`.scratch/prem-T7-pglite.mjs` montre le chemin et le rôle `service_role BYPASSRLS`).
- Après le lot : tests autonomes. dev-browser, profil `domaine` = session jakeb-test + Admin sur sonoo.app (elle a aussi un compte client) ; achats visiteur via `jakeb-test.sonoo.app` ; journaux Vercel. Valider ce que le code prouve à 100 %, reporter dans `ROADMAP.md`, puis donner deux listes « fait / validé » et « reste à tester » (étapes précises, noms des boutons, comment défaire).
- Faille trouvée = signalée et bloquée dans le lot. Le fonctionnel compte, pas l'apparence.

## Règles

- Aucun email réel hors liste blanche.
- Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo.
- Aucun changement DNS sans relevé avant/après et sans l'accord de Jake.
- Ne jamais réintroduire de donnée CRM ou de coordonnée de paiement dans `clients`.
- `leads` et `infos_paiement_compte` ne s'écrivent qu'avec la clé de service.
- Les données de test restent jusqu'à l'étape 17.

## Données de test laissées le 2026-11-17 (ménage à l'étape 17)

- Achat visiteur `b346e3d6` (`nicojacob83+prem-visiteur@`, « Paul Prerempli ») chez jakeb-test.
- Achats connectés du compte jakeb-test chez lui-même : `c22fd874`, `63c1dce1` (professionnel, Souvenir Records SAS), `16e52e5c`.
- La fiche jakeb-test de ce compte a 2 adresses (Paris, Lyon). Ses infos de compte sont effacées.
- Achats de Jake sur iPhone (T12/T13). Ses infos de compte sont peut-être encore gardées : il peut décocher la case dans Mon compte.
