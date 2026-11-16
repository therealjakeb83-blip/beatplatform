---
description: Clôturer la session — tout sauvegarder, mettre à jour les deux roadmaps, commit/push, préparer le prompt de redémarrage
---

Jake clôture la session. Ne commence aucun nouveau travail de code. Fais tout ce qui suit dans l'ordre, sans lui poser de question sauf si une information manque vraiment (dans ce cas, une seule question en situation + A/B).

## 1. Inventaire de la session

Relis toute la conversation et dresse la liste (pour toi) de :
- ce qui a été fait (code, SQL exécutés, commits) et ce qui a été validé (checklists T0-TN) ;
- les décisions de Jake (même petites, même prises en passant), avec leur raison ;
- les failles trouvées et comment elles ont été bloquées ;
- les pièges techniques et leçons apprises (bugs, faux diagnostics, méthodes qui ont marché) ;
- ce qui reste à faire, à tester, ou attend Jake (ménage, données de test, points notés pour un lot suivant) ;
- la prochaine étape exacte.

## 2. Mettre à jour les documents du projet

1. **`ROADMAP.md`** (roadmap « AI friendly ») : ligne « Dernière mise à jour » en tête (date du jour), section « Détail » du chantier en cours (checklist cochée avec résultats et dates, décisions, failles, « Noté pour le lot X »), ligne du chantier dans le tableau des rangs si son état change.
2. **`CLAUDE.md`** : paragraphe d'état de clôture (ce qui est terminé, règles nouvelles à respecter, prochaine étape et fichier de passation à lire en premier).
3. **Passation** : nouveau fichier `HANDOFF_CLAUDE_<CHANTIER>_<ÉTAPE>_<AAAA-MM-JJ>.md` à la racine (état en arrivant, intention de Jake à ne pas rouvrir, décisions, plan, ce qu'il faut lire/vérifier avant de commencer, méthode attendue, règles, ménage signalé). Supprimer (git rm) la passation précédente du même chantier qu'il remplace, et le dire dedans (« Remplace … »).
4. **Mémoire** (`C:\Users\nicoj\.claude\projects\c--Users-nicoj-beatplatform\memory\`) : mettre à jour la mémoire du chantier en cours (état, décisions, prochaine étape) ; créer une mémoire `feedback_…` pour chaque nouvelle préférence ou correction de Jake, une `project_…` pour chaque nouveau chantier/décision durable ; mettre à jour l'index `MEMORY.md` (une ligne par mémoire). Ne pas dupliquer ce que le repo enregistre déjà.

## 3. Roadmap « human friendly » : la page « Sonoo — Où on en est »

Suivre EXACTEMENT la procédure de la mémoire `reference_roadmap_human_friendly.md` (la relire d'abord) :
- charger le skill `artifact-design` ;
- `Artifact read` de l'URL https://claude.ai/code/artifact/e2029abb-abff-46e6-a1c2-73bd0fece34e et LIRE toute la version en ligne (par tranches) — jamais une copie locale ;
- appliquer les changements avec un script Python écrit avec l'outil Write (remplacements avec assertion « une seule occurrence », fichier en CRLF à normaliser) : version +1, historique de la session (en langage courant, sans fichiers ni code), chantier en cours (morceaux faits / restants, heures restantes), onglets « À faire » / « Terminés » (renuméroter, compteurs), « En attente de toi », fonctionnalités, décisions, total restant ;
- **compteur « temps déjà passé »** : recalculer selon `reference_compteur_temps_passe.md` (commits + temps actif de la session), mettre à jour le bloc et la barre du mois ;
- republier sur la MÊME URL (`url` = l'URL ci-dessus) pour garder le favori de Jake ;
- ajouter la ligne de version dans `reference_roadmap_human_friendly.md` et la mise à jour dans `reference_compteur_temps_passe.md` (+ le total dans l'index `MEMORY.md`).

## 4. Wiki-brain

Ajouter l'entrée de fin de session dans `C:\Users\nicoj\wiki-brain\log.md` :

```
## [AAAA-MM-JJ HH:MM] session | <titre en 3-8 mots>
Touchées : <pages wiki modifiées, ou "aucune">
```

Si la session a produit une connaissance durable hors projet, mettre à jour les pages wiki et `wiki\index.md`. Ne jamais toucher à `raw/`.

## 5. Commit et push

`git status`, puis commit de tous les fichiers du projet modifiés (message en français, attribution habituelle), puis push sur `main` — commit et push en commandes séparées. Ne jamais committer `.env.local` ni un secret.

## 6. Prompt de redémarrage

Rédige un prompt prêt à coller dans une nouvelle session, dans un bloc de code, sur le modèle de ceux de Jake :
- « Reprends Sonoo, <rang / chantier>, <étape> : <résumé en une ligne> » ;
- « Avant de répondre, lis : » CLAUDE.md, la nouvelle passation (en entier), la section ROADMAP concernée, les mémoires utiles, git log récent ;
- ce qui est TERMINÉ, et l'intention de Jake à ne pas rouvrir ;
- la première étape attendue (ex. vérifier en base / présenter la checklist T0-TN) et « Ne code rien avant mon feu vert » si c'est le début d'un lot ;
- la méthode habituelle : code sur main, commit + push après chaque changement, Jake teste sur sonoo.app ; SQL un par un (gros = lien cliquable vers le fichier, petit = dans le chat, où cliquer, vérification dans un onglet séparé) ; après le lot : tests autonomes, validation de ce qui est prouvé à 100 % par le code, report dans ROADMAP.md, listes « fait / validé » et « reste à tester » avec étapes précises, noms des boutons et comment défaire ; faille trouvée = signalée et bloquée dans le lot ; fonctionnel, pas l'apparence ;
- les contraintes : aucun email réel hors liste blanche, ne jamais lire .env.local, ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo, aucun changement DNS sans relevé avant/après et accord de Jake.

## 7. Message final à Jake

Court, en français, tutoiement :
- ce qui a été sauvegardé (liste brève : roadmap, page « Où on en est » vX avec le lien, passation, mémoire, wiki, commits) ;
- ce qui l'attend, lui (ménage, tests non faits) ;
- le prompt de redémarrage dans un bloc de code ;
- « Session clôturée. »
