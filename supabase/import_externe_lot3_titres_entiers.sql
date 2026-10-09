-- Import lot 3 — titres entiers (décision de Jake, 2026-10-09)
-- Le titre importé n'est plus coupé au premier « | » : seul le suffixe
-- « (COLLABORATOR) » ajouté par BeatStars est retiré. Recalcul des lignes déjà
-- importées depuis titre_original (article d'origine conservé à l'import).
-- Les liens déjà faits portaient sur les titres coupés (données de test) :
-- mémoire et beats reliés remis à zéro.
-- Limité à jakeb-test (seule boutique avec des commandes importées : voir le
-- SELECT de contrôle AVANT, à lancer d'abord).

-- ── 1. SELECT de contrôle AVANT (lecture seule) ──────────────────────────
-- SELECT b.slug, count(*) AS lignes,
--        count(*) FILTER (WHERE l.titre_original IS NULL) AS sans_original,
--        count(*) FILTER (WHERE l.beat_id IS NOT NULL) AS reliees,
--        (SELECT count(*) FROM liens_titres_externes lt WHERE lt.beatmaker_id = b.id) AS liens_memorises
-- FROM commandes_externes_lignes l JOIN beatmakers b ON b.id = l.beatmaker_id
-- GROUP BY b.slug, b.id;

-- ── 2. Migration ─────────────────────────────────────────────────────────
BEGIN;

UPDATE commandes_externes_lignes
SET titre = regexp_replace(regexp_replace(titre_original, '([[:space:]]*[(]COLLABORATOR[)])+[[:space:]]*$', '', 'i'), '^[[:space:]]+|[[:space:]]+$', '', 'g')
WHERE beatmaker_id = (SELECT id FROM beatmakers WHERE slug = 'jakeb-test')
  AND titre_original IS NOT NULL
  AND regexp_replace(regexp_replace(titre_original, '([[:space:]]*[(]COLLABORATOR[)])+[[:space:]]*$', '', 'i'), '^[[:space:]]+|[[:space:]]+$', '', 'g') <> '';

UPDATE commandes_externes_lignes SET beat_id = NULL
WHERE beatmaker_id = (SELECT id FROM beatmakers WHERE slug = 'jakeb-test')
  AND beat_id IS NOT NULL;

DELETE FROM liens_titres_externes
WHERE beatmaker_id = (SELECT id FROM beatmakers WHERE slug = 'jakeb-test');

COMMIT;

-- ── 3. SELECT de contrôle APRÈS ──────────────────────────────────────────
-- SELECT count(*) AS lignes,
--        count(DISTINCT lower(titre)) AS titres_distincts,
--        count(*) FILTER (WHERE titre ILIKE '%(COLLABORATOR)%') AS avec_collaborator,
--        count(*) FILTER (WHERE titre LIKE '%|%') AS avec_barre,
--        count(*) FILTER (WHERE beat_id IS NOT NULL) AS reliees,
--        (SELECT count(*) FROM liens_titres_externes WHERE beatmaker_id = (SELECT id FROM beatmakers WHERE slug = 'jakeb-test')) AS liens
-- FROM commandes_externes_lignes
-- WHERE beatmaker_id = (SELECT id FROM beatmakers WHERE slug = 'jakeb-test');
