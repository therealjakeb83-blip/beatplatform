# Note de côté — page « Sonoo — Où on en est » non mise à jour

**Complément du 21/11, sans publication :** la page et le compteur restent inchangés. Le Lot 1 bis est maintenant codé, les cinq SQL sont appliqués et vérifiés ; plusieurs essais réels sont faits, mais la validation finale reste ouverte. Refus/acceptation B validés, départ encore non effectué. Rattrapage détaillé : `HANDOFF_CLAUDE_SECURITE_9F_LOT1BIS_BILAN_CODEX_2026-11-21.md`. Les indications « Lot 1 bis non commencé » ci-dessous décrivent uniquement la clôture précédente. Inclure cette session au futur recalcul selon les règles du compteur, sans inventer sa durée.

Clôture du 2026-11-20 par Codex. **Jake a explicitement demandé de laisser cette page de côté et de noter qu'elle n'a pas été mise à jour.**

Page concernée : https://claude.ai/code/artifact/e2029abb-abff-46e6-a1c2-73bd0fece34e

**Aucune publication, aucune incrémentation de version, aucun compteur de temps en ligne modifié.** La dernière version consignée dans la mémoire est v81 (19 novembre au soir), pas une version relue en ligne par Codex. Le total ≈ 510 h de cette référence est historique ; ne pas le présenter comme recalculé à cette clôture.

## À réconcilier lors de la prochaine mise à jour de la page

- Lot 1 réalisé et déployé : fichiers dans un espace privé, accès aux documents contrôlé, données publiques limitées, journal des téléchargements acheteur et ancien stockage public fermé.
- 18 tests cochés sur 20, avec niveaux de preuve distingués dans ROADMAP.md ; Lot 1 en attente de validation finale.
- Reprise audio après une heure : échec réel de Jake, correctif `51948ae` déployé, simulation en ligne positive ; test réel T5 encore attendu, annoncé pour le 20 novembre à 16 h (Paris).
- T16 : vérification de 24 h de journaux reportée au 21 novembre. Aucun résultat à inventer, aucune automatisation créée.
- Lot 1 bis : préparation en lecture seule seulement, code et SQL non commencés, cadrage/checklist puis `/gocode` nécessaires. Le compartiment 8 attend toujours la validation du Lot 1.
- Compteur de temps : recalculer selon `reference_compteur_temps_passe.md`, depuis la dernière clôture réellement comptabilisée. Inclure le Lot 1 Claude du 20 novembre et la reprise Codex ; éviter le double comptage des commits, de la conversation et de l'attente passive du test d'une heure. Ne pas ajouter arbitrairement une heure pour cette attente.

Sources : `ROADMAP.md`, `HANDOFF_CLAUDE_SECURITE_9F_LOT1BIS_2026-11-20.md`, export `reprise-claude.txt`, commits de `251b89f` à `70e623e`, puis commit documentaire de cette clôture.

Pour reprendre la publication : lire la version EN LIGNE entière et les références de mémoire, appliquer le rattrapage sur la même URL, puis consigner la version réellement publiée. Cette note ne constitue pas une mise à jour de la page.
