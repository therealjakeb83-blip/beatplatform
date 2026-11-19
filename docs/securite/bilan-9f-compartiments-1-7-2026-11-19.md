# Sonoo — Bilan des audits 9f, compartiments 1 à 7

Date : 2026-11-19. Document de transmission, pas un nouvel audit ni la fusion des pistes. Aucun code corrigé. Dernier commit documentaire publié avant ce bilan : `76c4291`, sur `origin/main`.

## Ce qui est terminé

Les sept premiers compartiments ont été parcourus en **quick, lecture source seule**. Il s'agit de passages partiels, avec des zones différées et des conditions à valider. « Parcouru » ne signifie ni sécurisé, ni intégralement vérifié, ni corrigé.

Rapports détaillés : `C:\Users\nicoj\security-audit-skill\beatplatform\run-N\`. Les nombres ci-dessous proviennent des `findings.json` actuels ; ils comptent des enregistrements par passage, **pas des failles uniques**. Des racines sont reprises entre passages.

| Compartiment | Auteur et rapport | À valider | Rejetées | Confirmées dans ce passage |
|---|---|---:|---:|---:|
| 1 — Paiement et webhooks | Claude, run-1 | 10 | 1 | 0 |
| 2 — Comptes, connexion et domaines | Codex, run-2 | 8 | 2 | 0 |
| 3 — Admin | Codex, run-3 | 2 | 3 | 0 |
| 4 — Marketing et emails | Codex, run-4 | 5 | 3 | 0 |
| 5 — Business, imports et exports | Claude, run-5 | 8 | 1 | 0 |
| 6 — Base SQL | Codex, run-6 | 8 | 2 | 0 |
| 7 — Boutique publique | Codex, run-7 | 5 | 2 | 0 |

Les tests antérieurs de l'inventaire F1-F20 ont leur propre provenance ; ce tableau ne les annule pas et ne les transforme pas en validations nouvelles. Les pistes des runs ne reçoivent aucune gravité sans preuve autorisée.

## Apports à conserver pour la future fusion

- **Paiement/comptes** : C1/D1, compte confirmé et récupération après abonnement pour un email tapé ; C2, métadonnées vendeur au paiement express ; C3/C4, filtre et réponse révélant l'abonnement ; D3, trois routes de gestion acceptant un cookie sans imposer sa boutique à la recherche de l'abonnement cible. Conserver les conditions exactes, notamment l'identifiant d'abonnement connu pour D3 et l'impossibilité de créer par C1 un compte Auth déjà existant.
- **Admin** : A1 reprend F8-2, lectures protégées par layout ; A3, deux GET qui déclenchent des mutations avec session ambiante. Les mutations Admin possèdent par ailleurs des gardes de rôle : ne pas déduire d'A1 que les boutons sont librement utilisables.
- **Marketing** : M5, capacité de confirmation newsletter visible au vendeur dans ses logs, avec variante free download déjà relevée. Les injections/limites d'envoi connues restent F13/F11, sans nouveau comptage automatique.
- **Business** : B1, collaboration active falsifiable par écriture SQL propriétaire ; B2, acceptation d'invitation sans email confirmé selon configuration Auth ; B3/B4/B5, opposition newsletter effaçable ou statut écrit sur contact effacé ; B6, compteur global `nb_clients_crees` non affiché ; B7, amplification mémoire d'import ; B8, source marketing exposée au collaborateur.
- **SQL** : S1 = B1 ; S4 = variante SQL de F2a avec IP/date choisies ; S5 = B5 ; S6 = B3 ; S9 = F1/F9. Nouveautés S2/S3 : modération des catégories contournable par écritures directes. S10 : texte de contrat injecté via une licence étrangère sans texte personnalisé préexistant.

Ce regroupement est un aide-mémoire, pas un arbitrage de priorité ni une liste dédupliquée définitive. Les lots indiqués dans les rapports restent des affectations historiques/proposées jusqu'à la révision avec Jake.

## Contre-relecture Claude du compartiment 6

Document : `C:\Users\nicoj\security-audit-skill\beatplatform\run-6-relecture-claude\RELECTURE.md`, annoncé par le commit `2b7beb0`. Le run-6 d'origine n'a pas été modifié.

- S2 : une image externe de catégorie peut se retrouver sur les pages publiques d'autres boutiques ; ordre et configuration réelle à valider. Ce n'est pas une preuve de script exécuté sous Sonoo.
- S10 : outre le texte injecté dans le contrat, l'upsert du vendeur légitime peut être bloqué par la ligne étrangère. Licence cible sans texte préexistant nécessaire.
- S4 : acteur réaliste = vendeur contre son propre acheteur en litige, pas seulement un attaquant connaissant une commande tierce.

Cette relecture est source seule, par Claude sans agents. Elle ne prouve pas le comportement de la base réelle. Les formulations « confirmé dans le dépôt » de ce document ne deviennent pas des statuts `confirmed` dans les runs.

## Résultats du compartiment 7

Source : `2b7beb0`, code inchangé depuis `2724ece` sur les chemins comparés. Bilan publié dans `ROADMAP.md` par `76c4291`, push réussi sans hooks. Rapport : `run-7\REPORT.md` ; détails et conditions : `findings.json`, `NEEDS-VALIDATION.md`, `COLD-REVIEW.md`.

| Piste | Possibilité retenue ou réfutation | Tri / lot |
|---|---|---|
| P1 | Audio privé projeté derrière le verrou visuel de `/membres` si la RLS réelle admet la lecture ; la source SQL peut au contraire la bloquer. | Déjà F1/F9/S9 — 1 |
| P2 | Favori ancien relu en clé de service sans statut/date/suppression/collaboration ni abonnement courant : audio potentiellement conservé après perte du droit. Suppression physique en cascade exclue. | Nouvelle — 1 |
| P3 | Fiche et suggestions omettent la date : découverte d'un beat **public à date future**. Le statut `programme` est exclu de la fiche. | Nouvelle — 1 |
| P4 | Statut newsletter d'un effacé repris par compte/API et décision de consentement free download ; retour de fiche conservant le statut. | Déjà B5/S5, dépend B3/S6 — 4 |
| P5 | Formulaire/script hostile hébergé par une boutique non établi dans les champs publics lus. Rejet limité à cette chaîne, pas preuve générale anti-CSRF. | Rejetée — contrôle 7 |
| P6 | Changer slug/beatId seul ne retire pas les filtres identité/boutique des lecteurs compte/favoris/factures. C1/D3/D7/C5 restent distinctes. | Rejetée — contrôles 1/4 |
| P7 | Layout continue sur état boutique null ; panne mixte et admission plateforme nécessaires, proxy normalement fermé sur sous-domaine. | Déjà F19A — 1 |

P2 et P3 sont les deux nouveautés. P4 était déjà décrit dans B5 : ne pas le recompter. Une image distante S2 ne fournit pas la condition d'origine hostile manquante à P5.

## Limites et validations restantes

Runs 1 et 5 avec agents distincts ; D3 a eu une relecture distincte. Les autres décisions Codex des runs 2/3/4/6/7 n'ont pas toutes de vérification indépendante. Les éventuelles relectures Claude antérieures ne rendent pas le protocole multi-agent complet. Le run-7 porte explicitement `run_status: incomplete` pour cette limite, avec `source_pass_status: finished`.

Run-7 : une vague, une critique finale, réfutation par le même parent ; ledger 15 unités : 7 candidate dont 2 rejets, 3 covered sur invariants limités, 2 deferred, 3 out_of_scope. Les deux validateurs passent sur les formats, pas sur l'exploitabilité.

SQL posés à la main : le dépôt peut différer de Supabase. Codex n'a exécuté ni les quatre relevés du run-6, ni les deux du run-7. Ne présumer aucun résultat de Jake ; rechercher les nouveaux documents et le git log au moment de reprendre.

Relevés run-7 : `01-lecture-publique.sql` et `02-newsletter.sql`, métadonnées seulement. Mode d'emploi et résultats attendus dans `REQUETES.md` : Supabase → SQL Editor → New query → un fichier → Run. Aucune fonction métier à appeler ni ligne client à exporter pour ces relevés.

Reports importants conservés :

- course balayage/payer run-1 ; courses brancher/retirer/vérifier run-2 ; reprise suspension/réactivation après erreur partielle run-3 ; désinscription/effacement pendant lot préparé run-4 ;
- listes Commandes/Abonnements/Litiges côté collaborateur run-5 ; historiques juridiques et relations secondaires licence/beat run-6 ;
- action newsletter après déconnexion/changement de compte et ancien lien de confirmation après nouvelle opposition run-7, **différés sans faille supplémentaire affirmée** ;
- état hébergé, navigateur et invalidation du cache après révocation non validés par le run-7.

## Ordre de la suite

1. Petite contre-relecture ciblée des rejets **A2, A4, A5, M6, M7, M8**, avec recherche des trous évidents, selon décision A. Pas de réaudit complet des compartiments 3/4.
2. Fusion réelle des pistes F1-F20/C/D/A/M/B/S/P et lots revus avec Jake, une décision à la fois.
3. Code puis validation du **Lot 1**, seulement après `/gocode`.
4. **Compartiment 8 — fichiers et téléchargements, après le Lot 1.** Inclure le report run-5 des adresses de fichiers acceptées telles quelles et les frontières audio relevées au run-7.
5. Autres lots et passages standard paiement/comptes lorsque Jake les décide ; éventuel standard global avant lancement.

Aucune de ces étapes suivantes n'a été commencée pendant la rédaction de ce bilan. Lot 0 clos ; Lot 1 décidé mais non codé à cette date. Un compartiment est un périmètre d'audit ; un lot est un groupe de corrections : leurs numéros n'ont pas la même signification.
