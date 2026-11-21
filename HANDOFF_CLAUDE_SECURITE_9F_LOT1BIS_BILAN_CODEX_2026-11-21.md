# Passation Claude — Sonoo, rang 9f, Lot 1 bis

Clôture demandée par Jake le **21 novembre 2026, heure de Paris**. Arrêt des tests pour continuer avec Claude. Ce rapport couvre la session Codex des 20–21 novembre, depuis la reprise `e691caf`, et prime sur les anciens états disant « Lot 1 bis non commencé ».

## 1. État exact à la passation

- Projet : `C:\Users\nicoj\beatplatform`, branche **main**.
- **Lot 1 bis autorisé par `/gocode`, codé, poussé et observé sur sonoo.app.** Code principal : `502d75e`.
- **Les cinq SQL sont appliqués par Jake et vérifiés séparément**, dans l'ordre 5 → 1 → 2 → 3 → 4. Ne pas les refaire.
- Tests locaux et plusieurs essais réels terminés ; **Lot 1 bis PAS encore entièrement validé**.
- Refus puis acceptation d'une collaboration **confirmés par Jake après rechargement sur B**. L'acceptation reste à 50 %.
- **Prochain geste prévu mais NON effectué : Quitter**, sur `TEST 9f bis acceptation 20-11`, puis recharger et confirmer le départ.
- Dernier commit avant rédaction de ce rapport : `b16303c`, poussé, arbre propre lors du relevé de clôture. Le commit documentaire de cette passation sera postérieur ; lire `git status` et `git log` pour sa référence réelle.
- **Lot 1 précédent : T5 et T16 toujours ouverts.** Compartiment 8 non commencé.
- Page humaine « Sonoo — Où on en est » et compteur **NON mis à jour**. Aucune version publiée ni durée recalculée revendiquée.

## 2. Autorisation et décisions

Au départ, lecture seule demandée : CLAUDE.md, passation du 20/11 entière, ROADMAP rang 9f et T0–T19, fusion, mémoire sécurité, note de page humaine et Git lus. Graphify interrogé : aucun nœud correspondant, donc sources documentaires utilisées. Plan Lot 1 bis et checklist T0–T16 présentés, puis Jake a donné **`/gocode`**.

Périmètre conservé : S10 contrats ; B1/S1 collaborations ; S2/S3 catégories ; S7 listes (durcissement, pas fuite démontrée) ; B6 réponse d'import ; B8 source marketing entre boutiques ; droits techniques inutiles. Aucun nouveau choix produit à rouvrir. Règle Brevo et décisions du Lot 1 inchangées.

## 3. Code et SQL réalisés

| Sujet | Changement | Fichiers principaux |
|---|---|---|
| S10 | Le texte ET son archive contrôlent le propriétaire réel de `licence_id`. Générateur : licence et texte filtrés par vendeur ; erreur de lecture du texte = arrêt au lieu d'un contrat de secours silencieux. | `lib/contrat.ts`, `supabase/securite_9f_lot1bis_sql1_contrats.sql` |
| B1/S1 | Propriétaire du beat en SELECT seulement ; INSERT/UPDATE/DELETE retirés de PUBLIC/anon/authenticated, y compris INSERT/UPDATE de colonne. Les transitions légitimes restent côté serveur. | `supabase/securite_9f_lot1bis_sql2_collaborations.sql` |
| S2/S3 | Vendeur limité à ses catégories personnelles actives styles/type_beat. UPDATE contrôle l'ancienne ET la nouvelle ligne ; certification/altération d'une catégorie certifiée fermées. | `supabase/securite_9f_lot1bis_sql3_categories.sql` |
| S7 | WITH CHECK : sa liste + contact lié par lead/commande/abonnement + absence de fiche effacée. Lecture/retrait d'anciennes entrées conservés. | `supabase/securite_9f_lot1bis_sql4_listes.sql` |
| B6 | Réponse d'import par liste explicite : `nb_commandes`, `nb_lignes`, `nb_contacts_crees`, `nb_titres_non_relies`. Plus de `nb_clients_crees` ni de futur champ RPC imprévu. Transaction/annulation inchangées. | `app/api/business/imports-externes/importer/route.ts` |
| B8 | Source et identité acheteur non chargées sur les commandes étrangères. Source étrangère nulle dans le tableau, exclue de Source #1 et des séries ; aucune conversion artificielle en Direct. CA/parts conservés. | `app/api/business/analytics/ventes/route.ts`, `app/dashboard/business/analytics/_components/TabVentes.tsx` |
| Droits | Retrait TRUNCATE/REFERENCES/TRIGGER, et MAINTAIN si réellement présent, sur les tables `public`, pour PUBLIC/anon/authenticated. REFERENCES de colonne compris. GRANT directs serveur et défauts inchangés. | `supabase/securite_9f_lot1bis_sql5_droits_techniques.sql` |

SQL 1 s'arrête si un texte/archive est déjà rattaché au mauvais vendeur : **aucune suppression ou réparation automatique**. Aucun contrat déjà émis n'a été réécrit. Pourcentage Source #1 : dénominateur CA global existant conservé.

## 4. Relevés et vérifications réels de la base

Jake a fourni Q1 du run-6 (13 tables), puis `supabase/securite_9f_lot1bis_T0_complement.sql` : **62 tables, toutes RLS activées ; zéro texte et zéro archive incohérents**. Les règles fragiles attendues étaient réellement présentes, pas seulement dans les migrations du dépôt.

Le relevé a confirmé TRUNCATE accordé à `anon` sur plusieurs tables. Signalé immédiatement ; retrait technique passé en premier. TRUNCATE ignore les policies RLS, mais **aucune route publique l'exposant ni exploitation n'a été démontrée**. Aucun essai destructif en production. MAINTAIN également présent et inclus au retrait.

Inverses **issus de l'état réel**, sauvegardés avant application :

- `supabase/retour_9f_lot1bis/sql1_inverse.sql`
- `supabase/retour_9f_lot1bis/sql2_inverse.sql`
- `supabase/retour_9f_lot1bis/sql3_inverse.sql`
- `supabase/retour_9f_lot1bis/sql4_inverse.sql`
- `supabase/retour_9f_lot1bis/sql5_inverse.sql`

Résultats transmis par Jake, après chaque SQL :

| SQL | Preuve séparée reçue |
|---|---|
| 5 | `droits_techniques_restants = 0`, table/colonne, anon/authenticated, quatre droits techniques. |
| 1 | Trois policies authenticated : texte ALL avec USING/CHECK propriétaire réel ; archive INSERT avec CHECK et SELECT avec USING identiques. |
| 2 | anon : aucune lecture/écriture ; authenticated : lecture oui, écritures table et colonne toutes false ; service_role : lectures/écritures conservées. Deux policies SELECT, propriétaire et collaborateur. |
| 3 | Quatre policies attendues, SELECT inchangé ; INSERT/UPDATE/DELETE personnels actifs styles/type_beat, conditions anciennes/nouvelles sur UPDATE. |
| 4 | Une policy ALL authenticated ; USING propriétaire de la liste, CHECK relation boutique/contact + non effacé. |

Les vérifications de métadonnées sont terminées. **Cela ne transforme pas un refus testé dans PGlite en tentative hostile réellement exécutée sur le site.**

## 5. Tests locaux et contrôles techniques

- `scripts/test-securite-9f-lot1bis.mjs <chemin-vers-pglite/dist/index.js>` : quatre contournements reproduits avant ; migrations exécutées deux fois ; cinq inverses réels exécutés ; droits serveur préservés et matrice ACL des trois rôles sur 62 tables restaurée exactement. **34 contrôles OK** sur PostgreSQL 18.7 / PGlite 0.5.17. Premier passage sur l'ancien PGlite PG16 : 30 contrôles, avant ajout MAINTAIN et ACL complètes.
- Fixtures sans données client : `scripts/fixtures/securite-9f-lot1bis-policies.sql` et `scripts/fixtures/securite-9f-lot1bis-acl.json`. Schéma minimal ; pas de reproduction intégrale des déclencheurs de production.
- PGlite récent installé hors dépendances du projet : `C:\Users\nicoj\.scratch\9f-lot1bis-pg17\node_modules\@electric-sql\pglite\dist\index.js`. Malgré le nom du dossier, ce paquet donne PG18.7. Ne présumer ni la présence future de ce dossier ni celle des anciens chemins temporaires.
- `node scripts/test-securite-9f-lot1bis-routes.mjs` : **9 scénarios OK** sur le vrai code, adaptateurs simulés. PDF réels par défaut/personnalisé ; refus propriétaire et erreur de lecture ; Analytics indépendant des sources étrangères ; montants préservés ; réponse import indépendante du compteur global ; 401 sans session. Aucun réseau/email/.env dans ces tests.
- `npx tsc --noEmit` passe. ESLint ciblé serveur/scripts sans erreur, avertissement `_id` préexistant. `TabVentes` : erreur préexistante `react-hooks/set-state-in-effect` ligne 40, reproduite sur HEAD avant modification ; contrôle ciblé passe avec cette seule règle désactivée. Aucun effet React corrigé hors lot.
- Build webpack dans une copie isolée sans `.env` : compilation et TypeScript passent ; prérendu Admin impossible sans base (essai sans configuration, puis valeurs locales fictives). **Aucun build local complet réussi revendiqué.** Nouveau JavaScript de TabVentes observé sur sonoo.app après push ; console/build Vercel non lue.
- Pas de changement de `package.json` ni du lockfile du projet.

## 6. Essais réels faits en autonomie sur sonoo.app

### Listes

Liste `TEST 9f bis listes 20-11` : ajout du contact existant `nicojacob83+9flot1@gmail.com`, relecture un contact, retrait puis relecture zéro contact ; liste ensuite supprimée et absence vérifiée. Pas de campagne, pas de modification de la fiche client. Fusion réelle non rejouée.

### Catégories

Beat neuf masqué sans fichier ni licence active ; style `TEST9FBIS2011` créé puis renommé `TEST9FBIS2011REN`. Demande vue côté Business et Admin, approuvée dans Admin ; côté vendeur : Certifiée, plus de commandes de modification. Beat ensuite retiré. Email de certification journalisé Envoyé à `nicojacob83+test@gmail.com` (liste blanche). La catégorie certifiée et son historique **restent** en base ; ne pas annoncer un nettoyage total.

### Texte et archive de licence

Licence MP3 de A `ff4b6323-5364-4691-928f-090616637623` : contenu existant réenregistré identique, PATCH 200, version 5 → 6. Formulaire relu identique ; comparaison du journal 200, ancienne et nouvelle versions présentes et identiques. CRLF normalisés seulement pour comparer au DOM. Bouton de modèle par défaut essayé **sans sauvegarde**, puis original restauré et rechargé : version 6 inchangée. Aucune mention légale modifiée ; version et journal identiques conservés.

### Import B6

CSV synthétique BeatStars `9f-lot1bis-test.csv`, référence `9FBIS-TEST-2011`, vente 15/01/2024, 1 USD, contact existant whitelisted. Analyse 200, import 200 ; réponse exacte : 1 commande, 1 ligne, 0 contact créé, 632 titres non reliés. Pas de compteur global. Annulation par l'interface 200 : 1 commande supprimée, 0 contact supprimé/conservé. Historique Annulé relu ; compteur de commandes importées revenu au départ. Aucun email d'import.

### Invitation et retrait autonomes

Beat masqué `TEST 9f bis collab 20-11`, sans fichier/licence active. Invitation à `nicojacob83+9fbis-collab@gmail.com`, 50 %, création 200, état En attente relu ; retrait par bouton 200, historique Invitation retirée et zéro invitation active relus. Beat ensuite retiré. Deux emails Envoyé, à cette seule adresse whitelisted.

### Analytics et accès sans session

Après déploiement, cinq SQL et essais : GET Ventes authentifié 200, **395 commandes et CA brut 19 254,55 € inchangés**. Aucune vente reçue en collaboration sur A : la protection de source étrangère n'est pas encore vérifiée sur B. Sans session, GET Analytics Ventes, POST import et PATCH texte donnent tous 401.

### Tentative de contrat neuf

Code `TEST9FBIS2011PDF` : 100 %, une utilisation, limité à Anarchy et `nicojacob83+9fbis-pdf@gmail.com`. Tentative à 0 € refusée 400 `Licence désactivée pour Anarchy`. Vérification : ses licences sont effectivement désactivées ; **aucun réglage changé, aucune commande créée**. Code désactivé ensuite (200). Contrat neuf en production encore à tester sur un beat réellement achetable. Aucun paiement réel effectué.

## 7. Tests B guidés par Jake — derniers résultats

- Compte B : **`nicojacob83+2809a@gmail.com`**, boutique `nic-beat-2809` (ancien slug `nic-beat-2809-22410af7`). Email retrouvé dans les notes puis confirmé par Jake via SQL.
- Jake effectue **tous les clics côté B dans son propre navigateur**. Ne pas reprendre automatiquement la main sur sa saisie.
- Dev Browser B distinct `lot1bis-b` ouvert, arrêté à « Bientôt disponible ». Jake **ne partage pas l'accès maintenance** ; ne pas contourner cette limite, transférer un jeton ou lire `.env.local`. Le mot de passe de compte donné dans la conversation n'a pas été utilisé pour une connexion et ne doit pas être recopié dans la passation ou les notes.
- `TEST 9f bis croise 20-11` : **refus confirmé par Jake après rechargement**.
- `TEST 9f bis acceptation 20-11` : **acceptation à 50 % confirmée par Jake après rechargement**.
- Dernière instruction prévue : sur B, Commerce → Collabs → ce second beat → **Quitter**, confirmer « Le propriétaire repasse à 100 % », recharger. **Jake n'a PAS encore fait/confirmé ce test.**

Le 20/11, la tentative de sauvegarde de la confirmation d'acceptation avait échoué parce que la revue automatique ne pouvait plus s'exécuter à la limite d'utilisation ; ce n'était pas une décision d'insécurité. Rattrapage documentaire effectué le 21/11 dans `b16303c`. Ne pas confondre ce blocage d'outil avec un échec fonctionnel de Sonoo.

## 8. Données de test et nettoyage exact

| Objet | Identifiant / nom | État connu à l'arrêt |
|---|---|---|
| Liste du test | `fe08ffa6-9710-41bb-8ac9-bac4a878bbda` | Supprimée, absence relue. |
| Beat catégories | `cacbca11-9b82-4fcd-b372-8cf3d5f305f0` | Suppression douce 200, absent du catalogue. |
| Catégorie test | `TEST9FBIS2011REN` | Certifiée, conservée avec historique. Aucun beat de test actif la portant. |
| Licence MP3 A | `ff4b6323-5364-4691-928f-090616637623` | Version 6 identique à 5, archive et journal conservés. |
| Import | `9f-lot1bis-test.csv` / `9FBIS-TEST-2011` | Annulé ; commande synthétique supprimée, historique conservé. |
| Beat invitation/retrait autonome | `6933d8aa-5633-4c0d-a5f3-013211264fef` | Invitation retirée, beat supprimé logiquement ; historique conservé. |
| Code de contrat neuf | `cb5513aa-8d25-47c5-a410-f99bd6891f2d` / `TEST9FBIS2011PDF` | Inactif, aucune commande créée. |
| Beat du refus B | `3ef6bdf5-4d57-404c-b2bd-62b0e8ac81eb` / `TEST 9f bis croise 20-11` | Masqué, sans fichiers/licences actives ; invitation refusée par B. Pas retiré à l'arrêt. |
| Beat de l'acceptation B | `d2d692ba-7052-4fa7-96b3-bc01d254172e` / `TEST 9f bis acceptation 20-11` | Masqué, sans fichiers/licences actives ; acceptation 50 % confirmée. Départ non fait. |

Aucun fichier de stockage créé ou supprimé par ces essais Lot 1 bis. Ne pas toucher aux données du Lot 1, notamment au beat Test 9f devenu Anarchy, ni réactiver l'ancien stockage public. Ne pas supprimer les historiques juridiques pour rendre le test invisible.

## 9. Ce qui reste exactement

Checklist complète : `docs/securite/lot1bis-9f-2026-11-20.md`. Cases déjà cochées : T0/T1/T3/T9/T11/T13. T6 reste partiel malgré refus/acceptation validés.

1. **T6 : départ volontaire**, puis **éviction par le propriétaire avec motif**, en passant par une nouvelle invitation acceptée si nécessaire. Tests un par un, libellés réels. Ne pas envoyer de notification hors liste blanche.
2. **T7/T12 : vente collab et Analytics côté B** : part exacte, source marketing de A absente des lignes, de Source #1 et des séries ; CA préservé. Utiliser d'abord les commandes de test existantes si suffisantes, ne pas prétendre avoir joué une nouvelle vente si seulement lue.
3. **T4 : contrat neuf**, sur un beat achetable ; vérifier PDF par défaut/personnalisé selon preuve obtenue. Anarchy n'est pas prêt côté licences ; pas d'activation silencieuse de ses licences pour forcer le test.
4. **T10 : fusion de contacts dans une liste**, scénario restant ; ajout/retrait normal déjà validés.
5. **T2/T5/T8 : dernières preuves de refus direct en base réelle** pour texte étranger, écritures collab, certification/altération officielle. PGlite et policies réelles déjà validés ; tentatives directes en ligne pas faites. Garder ce niveau de preuve exact, utiliser uniquement des objets de test et un protocole non destructif. Ne pas lancer un nouvel audit général.
6. **T14/T15/T16 du Lot 1 bis** : compléter contrôles de déploiement avec la réserve de lint existante, reporter chaque résultat, bilan final et données conservées. Ne pas refaire les tests locaux sans nouveau changement/échec pertinent.

Il n'y a aucun nouveau développement produit prévu à ce stade. Si un vrai défaut est trouvé, le signaler et le bloquer selon la méthode convenue, sans élargir silencieusement le lot.

## 10. Lot 1 précédent — suivi séparé

- **T5** : correctif `51948ae` déjà déployé avant ce Lot 1 bis ; tests locaux et expiration simulée OK. Jake rapporte ensuite : une heure sur **PC Edge**, retour = **rechargement automatique de la page**, puis écoute OK. Cela ne valide ni ne réfute le renouvellement sans rechargement. Cause non établie ; aucun reload explicite trouvé dans le lecteur au retour visible. T5 reste ouvert. Pour une reprise longue durée, éviter les déploiements pendant l'attente et distinguer rechargement/discard du navigateur d'un renouvellement audio.
- **T16** : 24 h de journaux Vercel à contrôler le **21 novembre**, **pas encore fait**. Ancienne preuve : seulement 2 h sans erreur/adresse de fichier. Aucune automatisation ou rappel créé.
- **Compartiment 8 seulement après code ET validation du Lot 1** ; ne pas le démarrer maintenant.

## 11. Historique Git de cette session

| Commit | Objet |
|---|---|
| `502d75e` | Code et SQL préparés du Lot 1 bis, tests initiaux. |
| `107566e` | ACL réelles, inverses exacts, tests et suivi du SQL 5. |
| `892906e` | Vérification SQL 5. |
| `3972e60` | Vérification SQL 1 contrats. |
| `7d28547` | Vérification SQL 2 collaborations. |
| `6b08402` | Vérification SQL 3 et précision T5 PC Edge. |
| `88f2a0e` | Cinq SQL vérifiés, essais autonomes réels, restes. |
| `b16303c` | Rattrapage refus/acceptation B et reprise du 21/11. |

Tous ces commits ont été poussés sur main par commandes commit/push séparées. Ne pas confondre `51948ae` (Lot 1 antérieur) avec une correction réalisée dans ce Lot 1 bis.

## 12. Règles de reprise et retours

- Lire ce rapport **en entier**, CLAUDE.md, le bilan/checklist Lot 1 bis, le bloc 9f de ROADMAP et `docs/securite/fusion-9f-2026-11-19.md`. Ancienne passation du 20/11 = historique. Mémoire `project_securite_9f_avant_audit_externe.md` peut avoir des états antérieurs : priorité aux preuves datées ici.
- Code sur main, contrôles pertinents, commit puis push **séparés** ; tests sur **sonoo.app**. Lire les guides Next locaux avant toute modification de code.
- SQL un par un, PGlite d'abord, vérification séparée et inverse exact fourni. Les cinq migrations de ce lot sont déjà passées.
- Défaire le code : `git revert <commit ciblé>` après analyse, contrôles et push séparé. Inverses SQL dans `supabase/retour_9f_lot1bis/` ; retour intégral dans l'ordre **4 → 3 → 2 → 1 → 5**. Ils rouvrent les règles/droits antérieurs : ne pas les exécuter comme ménage de test.
- Fonctionnel avant apparence ; faille réelle signalée et bloquée. Garder distinction preuve locale, métadonnées réelles, essai autonome en ligne et confirmation de Jake.
- **Jamais `.env.local`**, aucun contournement d'un refus, aucun email hors liste blanche, aucun mot de passe dans notes/scripts/Git. Ne pas toucher WordPress, configuration des emails jakebmusic.com ni mentions Sonoo. DNS seulement après accord et relevé avant/après.
- Page humaine/compteur laissés de côté : `docs/securite/NOTE_ROADMAP_HUMAINE_2026-11-20.md` ; son état « Lot 1 bis non commencé » est une photographie ancienne. Cette clôture n'a rien publié ni recalculé. Au futur rattrapage, lire la page en ligne et les règles du compteur, sans compter l'attente passive ni doubler les sessions.
- Wiki : `C:\Users\nicoj\wiki-brain\wiki\beatplatform-securite-9f-novembre-2026.md` ; tenir index et journal à jour, ne jamais modifier `raw/`.

**Reprise recommandée : rappeler brièvement l'état, puis guider Jake sur Quitter pour la collaboration acceptée. Ne pas considérer ce départ acquis.**
