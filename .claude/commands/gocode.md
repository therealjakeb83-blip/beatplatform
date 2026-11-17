---
description: Feu vert de Jake — coder le chantier cadré, SQL dès que possible, valider ce qui est prouvé par le code, tester seul tout le reste, rendre deux listes
---

Jake donne le feu vert pour coder le chantier (ou le lot) qui vient d'être cadré : décisions prises une par une + checklist T0-TN dans `ROADMAP.md`. Si aucune checklist validée n'existe, arrête-toi et dis-le (une phrase) au lieu de coder.

Fais tout ce qui suit dans l'ordre, sans lui poser de question sauf blocage réel (dans ce cas : une seule question en situation + A/B + recommandation).

## 1. Coder

- Relis la checklist et les décisions du chantier dans `ROADMAP.md` et sa mémoire `project_…` ; respecte aussi `CLAUDE.md` et les règles des chantiers précédents (« à ne pas rouvrir »).
- Code sur `main`. **Commit + push après chaque changement cohérent** (messages en français sans accents, ligne Co-Authored-By de la session).
- Vérifie au fil de l'eau : `npx tsc --noEmit` et `npx eslint` sur les fichiers touchés.
- Toute faille trouvée en route = signalée et bloquée dans le lot.
- Jamais de `.env.local` lu, aucun email réel hors liste blanche, pas de WordPress / emails jakebmusic.com / mentions Sonoo, aucun changement DNS.

## 2. SQL : le donner à Jake dès que possible, sans brûler les étapes

- Dès que le SQL est STABLE (le code qui l'utilise est écrit, rien ne le fera plus changer), essaie-le sur **PGlite** (harnais dans `.scratch/`, ex. `.scratch/9d-lot5-T4-pglite.mjs`), commit + push le fichier `supabase/…sql`, puis **envoie-le tout de suite à Jake** et continue de coder pendant qu'il l'exécute.
- Un SQL à la fois, une transaction, filtre exact + SELECT de contrôle avant toute modification, nouvelle fonction = REVOKE public/anon/authenticated + GRANT service_role.
- Petit SQL = collé dans le chat ; gros = lien cliquable vers le fichier. Toujours : où cliquer (Supabase → SQL Editor → New query), quoi coller, ce qu'il doit voir, et une requête de vérification à lancer dans un onglet séparé.
- Le code qui dépend du SQL ne doit pas casser le site tant que le SQL n'est pas exécuté (ou bien dis à Jake de ne pas tester avant).
- Mets ce SQL aussi dans le message final s'il n'a pas encore été exécuté.

## 3. Valider ce qui est prouvé à 100 % par le code

Quand tout est codé et poussé, passe la checklist ligne par ligne et coche (✅ + date + preuve : fichier/ligne, raisonnement) tout ce que le code prouve sans aucun doute. Ce qui n'est prouvé qu'en partie reste à tester.

## 4. Tester seul tout ce qui peut l'être, sans intervention de Jake

- Attends que le déploiement Vercel soit Ready.
- Appels directs (scripts dans `.scratch/`), PGlite, `dev-browser` (profil `domaine` = session jakeb-test + Admin ; achats visiteur via `jakeb-test.sonoo.app`, carte 4242), journaux Vercel (`npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects …`).
- Lectures en base possibles : scripts lancés par Jake seulement si indispensables ; sinon, ce que l'Admin et le dashboard montrent.
- Un défaut trouvé = corrigé, commit + push, retesté.
- Un test qui demande Jake (session client, email reçu, téléphone réel) n'est PAS tenté de force : il va dans « reste à tester ».

## 5. Reporter et rendre

- `ROADMAP.md` : checklist cochée avec résultats, dates, commits, données de test laissées ; mémoire du chantier mise à jour. Commit + push.
- Message final à Jake (français, tutoiement, simple), avec **deux listes** :
  1. **Fait / validé** : chaque T, comment il est prouvé (code ou test fait).
  2. **Reste à tester (par toi)** : pour chaque T, étapes numérotées précises (adresse, noms exacts des boutons, ce que tu dois voir) et **comment défaire** ce que le test crée.
- Plus, si besoin : le SQL à exécuter s'il ne l'est pas encore, et les failles trouvées / bloquées.
