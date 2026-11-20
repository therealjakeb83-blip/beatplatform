# Passation — Sonoo, rang 9f : fin du Lot 1 et préparation du Lot 1 bis

## Suite prioritaire — réalisation du Lot 1 bis, 20 novembre

Depuis cette passation, Jake a donné `/gocode`. Code `502d75e` poussé sur main, nouveau code public constaté sur sonoo.app ; SQL 5 appliqué par Jake (succès annoncé), vérification séparée attendue ; SQL 1/2/3/4 non appliqués. Détail, checklist T0–T16 et procédure de retour : `docs/securite/lot1bis-9f-2026-11-20.md`. Q1 réel reçu ; complément T0 reçu : 62 tables RLS, zéro incohérence texte/archive ; cinq inverses réels sauvegardés et testés. SQL 5 appliqué par Jake (succès annoncé), vérification séparée attendue avant SQL 1/2/3/4 un à un. Les droits TRUNCATE d'anon sont réels dans Q1, signalés sans essai destructif ; MAINTAIN pris en compte. PGlite : 34 contrôles PG18 et cinq inverses réels OK, neuf scénarios routes/contrats ; TypeScript OK, erreur lint React préexistante ; compilation locale OK, prérendu exige la base. Code servi en ligne observé, Analytics 200 et totaux inchangés, trois routes sans session 401. Validation réelle du lot non terminée. T5/T16 Lot 1, compartiment 8 et page humaine restent inchangés. Le reste de cette passation décrit le point de départ historique.

Date : 2026-11-20, clôture Codex. Projet : `C:\Users\nicoj\beatplatform`, branche `main`.
**Remplace `HANDOFF_CLAUDE_SECURITE_9F_LOT1_CODE_2026-11-19.md`**, supprimée à cette clôture : elle décrivait un Lot 1 encore à coder.

## État en arrivant

- Lot 0, inventaire F1-F20, audits des compartiments 1 à 7, contre-relecture des rejets et fusion des pistes terminés.
- **Lot 1 codé et déployé. Il reste uniquement T5 et T16 avant sa validation finale.** Les 18 autres cases sont cochées dans ROADMAP.md ; distinguer les essais réels des validations par lecture du code (notamment T13/T17/T18 et certaines branches T10/T12).
- **T5 : Jake a réellement constaté l'échec après une heure, sans reprise possible avant rechargement.** Codex a corrigé la reprise du même beat, commit `51948ae`, déployé et vérifié sur le site. Ce correctif doit encore passer le test réel après une heure, annoncé pour **16 h le 20 novembre, heure de Paris**. Ne pas transformer cette heure prévue en résultat acquis ; demander le résultat à la reprise si nécessaire.
- **T16 : vérification des journaux Vercel sur 24 h reportée au 21 novembre par Jake.** Claude avait rapporté seulement 2 h sans erreur ni adresse de fichier ; Codex n'a pas effectué le contrôle 24 h. Aucune tâche automatique ni rappel n'a été créé.
- Jake demande d'avancer pendant ces attentes : **préparation du Lot 1 bis en lecture seule commencée**, aucun code ni SQL de ce nouveau lot exécuté, aucun `/gocode` reçu pour lui.
- Page « Sonoo — Où on en est » **NON mise à jour**, expressément accepté par Jake pour cette clôture. Note de rattrapage : `docs/securite/NOTE_ROADMAP_HUMAINE_2026-11-20.md`. Ni version ni compteur de temps en ligne modifiés.

## Ce que Claude avait déjà terminé avant la reprise Codex

Référence finale de Claude : `89013a4` (T2 complet validé par Jake). Export lu : `C:\Users\nicoj\Downloads\reprise-claude.txt` ; les images n'y sont que des marqueurs, pas des captures consultables.

- Espace R2 `sonoo-prive` sans adresse publique, liens temporaires audio de 1 h, documents à adresse Sonoo avec accès contrôlé, cookie `dl_` signé, 5 essais d'email ratés puis blocage 1 h.
- Migration : 637 copies, 628 lignes réécrites, vérification fichier par fichier ; 436 originaux sensibles effacés de `sonoo`, images conservées publiques.
- `beats` / `beatmakers` fermées aux visiteurs et comptes artistes ; vendeur limité à ses lignes ; lecture publique côté serveur.
- Journal acheteur uniquement ; preuves Stripe limitées à `appareil_paiement`, `compte_acheteur`, `lien_email` ; email tapé jamais envoyé comme preuve. Écriture directe du journal fermée (S4).
- Ancien espace `myproducer-beats` : adresse publique désactivée, fichiers conservés jusqu'à l'étape 17. Ne pas le réactiver pour tester le lecteur.
- T2 : Jake a créé « Test 9f » avec les quatre fichiers, champs « Fichier existant ». État du beat de test à conserver sauf demande de ménage.

## Correctif Codex de T5

Défaut trouvé : `play` sur le même beat et `togglePlay` faisaient `audio.play()` sans vérifier l'expiration ; le changement de beat était le seul chemin qui la vérifiait. Attendre l'événement `error` ne garantissait donc pas la reprise.

`app/[slug]/_components/PlayerContext.tsx` : reprise commune, renouvellement avant lecture, restauration de la position, annulation des réponses tardives après pause/changement de beat, préparation du lien au retour dans une page visible sans lancer de lecture automatique. `play()` n'attend plus `loadedmetadata` lorsque le lien est disponible ; ne pas prétendre que cela valide Safari réel.

Preuves :
- `node scripts/test-lecteur-reprise.cjs` : 7 cas OK (les deux boutons, annulation, changement de beat, refus serveur, retour visible, erreur média).
- `node scripts/test-lecteur-reprise.cjs --avant` : échec attendu sur `89013a4`, absence de renouvellement à la reprise.
- `tsc --noEmit`, eslint ciblé et `git diff --check` passent.
- Chromium sur `https://jakeb-test.sonoo.app/beats`, son coupé, expiration **simulée par horloge côté navigateur** : bouton du lecteur = 1 renouvellement HTTP 200, source changée, reprise 42 → 42,8 s ; carte du même beat = 1 renouvellement, reprise 57 → 58,2 s ; suivant = départ à 0,8 s, aucune erreur média. Pas de rechargement. Horloge restaurée, lecteur laissé en pause.
- Cela ne remplace pas une attente réelle > 1 h ni un essai sur iPhone.

Commits Codex avant cette clôture : `51948ae` (correctif et tests), `70e623e` (preuves en ligne dans ROADMAP). Commit/push explicitement autorisés par Jake après un refus de revue automatique. Piège d'outil : PowerShell peut démarrer dans le dossier personnel malgré `workdir` ; utiliser `git -C C:\Users\nicoj\beatplatform`.

## Lot 1 bis : périmètre et première étape

Périmètre déjà décidé par la fusion : S10 contrats, B1/S1 collaborations, S2/S3 catégories, S7 listes (durcissement, pas fuite démontrée), B6 réponse d'import, B8 source marketing entre boutiques, droits techniques inutiles.

Lecture préliminaire de S10 faite :
- `supabase/licences_editables_texte_par_licence.sql` : la policy de `licences_textes` ne contrôle que le propriétaire déclaré du texte, pas celui de `licence_id`.
- `app/api/licences/textes/route.ts` contrôle déjà le propriétaire ; le contournement passe par une écriture directe en base.
- `lib/contrat.ts` charge le texte avec la clé de service par `licence_id` seul. Vérifier aussi l'appartenance au vendeur lors de la génération.
- Piste déjà connue, pas une nouvelle faille ni un état réel de la base revérifié. Lire les migrations suivantes avant toute correction.

**Première étape de la prochaine session :** rappeler T5/T16 sans les recocher, lire les documents ci-dessous, terminer le cadrage du Lot 1 bis et proposer son plan + checklist T0-TN en langage simple. Contrats en premier, puis collaborations recommandés ; ce n'est pas encore un plan de code complet validé. Ne coder qu'après `/gocode` de Jake. Réutiliser les relevés T0 existants puis demander seulement les métadonnées manquantes, en lecture seule.

Ordre prévu : Lot 1 → Lot 1 bis → compartiment 8 fichiers (seulement après code ET validation du Lot 1) → Lots 2 à 7. Ne pas lancer le compartiment 8 maintenant. Une session par lot.

## À lire

1. `CLAUDE.md`, cette passation en entier, section Rang 9f de `ROADMAP.md` (décisions + checklist T0-T19 + clôture du 20 novembre).
2. `docs/securite/fusion-9f-2026-11-19.md` (Lot 1 bis et décisions finales), `docs/securite/inventaire-9f-2026-11-17.md` au besoin.
3. Mémoire `project_securite_9f_avant_audit_externe.md`, `git log` récent et `git status`.
4. Pour Lot 1 bis : `C:\Users\nicoj\security-audit-skill\beatplatform\run-5`, `run-6`, `run-6-relecture-claude` ; requêtes de lecture dans `run-6`. Les rapports de source ne prouvent pas l'état actuel de la base.

## Intention et méthode à conserver

- Tout ce qui n'est pas affiché est caché. Fichier obtenu par achat ou free download activé ; écoute par lien temporaire, privé seulement pour abonné. Décisions 1-5 du Lot 1 acquises.
- Règle newsletter « Brevo » acquise (voir fusion) : ne pas rouvrir le consentement vendeur ni la confirmation du formulaire public pour tous.
- Code sur `main`, contrôles puis commit et push après chaque changement, commandes séparées ; Jake teste sur sonoo.app. Lire la documentation locale de Next avant tout nouveau code.
- SQL un par un, PGlite d'abord, gros = lien cliquable, petit = chat, où cliquer et vérification séparée, inverse fourni.
- Décisions une par une en situation A/B ; rangement technique délégué. Tests Jake un par un, noms réels des boutons : statut « Masqué », pas « Brouillon ». Après le lot : listes « fait/validé » et « reste à tester », résultats datés et niveau de preuve exact. Fonctionnel avant apparence.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local` ; scripts qui en ont besoin via le terminal de Jake. Ne pas contourner un refus.
- Ne toucher ni à WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo. DNS seulement avec accord et relevé avant/après. Ne pas contourner Qustodio pour Stripe.
- Données de test laissées ; pas de suppression de fichiers du stockage ni de nouvelle migration pendant cette clôture.

## Reports

- Rattrapage de la page humaine et du compteur de temps : note dédiée ; aucune nouvelle version publiée.
- Le détail T2 de ROADMAP gardait une phrase « Reste : créer un vrai beat… » bien que T2 soit validé : corrigé à cette clôture.
- Ancien nom de bucket local signalé par Claude : ménage à l'étape 17, sans lecture du `.env.local` par Codex.
- Petites corrections : campagnes planifiées segment/liste potentiellement sans destinataire ; groupe newsletter (avertissement vendeur, B5, bienvenue, case free download) quand Jake le décide. Reports du passage standard inchangés dans la fusion.
