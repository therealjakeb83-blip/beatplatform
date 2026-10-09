-- Analytics coupé à 1 000 lignes (2026-10-09, décision de Jake) : les écoutes,
-- free downloads et favoris sont comptés DANS la base au lieu d'être lus ligne
-- par ligne (Supabase ne renvoie jamais plus de 1 000 lignes par lecture).
-- Création seulement : aucune donnée existante n'est modifiée.
-- Réservé au serveur (service_role) : les fonctions prennent l'id de la
-- boutique en paramètre, un navigateur ne doit jamais pouvoir les appeler.

BEGIN;

CREATE INDEX IF NOT EXISTS beat_plays_beatmaker_played_idx       ON beat_plays (beatmaker_id, played_at);
CREATE INDEX IF NOT EXISTS free_downloads_beatmaker_download_idx ON free_downloads (beatmaker_id, downloaded_at);
CREATE INDEX IF NOT EXISTS favoris_beat_idx                      ON favoris (beat_id);

-- Totaux par beat sur une période. Bornes incluses des deux côtés, null = pas
-- de borne (même règle que inPeriod() côté code).
CREATE OR REPLACE FUNCTION analytics_evenements_par_beat(
  p_beatmaker_id uuid,
  p_de           timestamptz,
  p_a            timestamptz
) RETURNS TABLE (beat_id uuid, ecoutes bigint, duree_somme bigint, duree_nb bigint, free_dl bigint, favoris bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH ev AS (
    SELECT p.beat_id, 1 AS e, p.duree_secondes AS d, 0 AS f, 0 AS v
      FROM beat_plays p
     WHERE p.beatmaker_id = p_beatmaker_id
       AND (p_de IS NULL OR p.played_at >= p_de)
       AND (p_a  IS NULL OR p.played_at <= p_a)
    UNION ALL
    SELECT fd.beat_id, 0, NULL, 1, 0
      FROM free_downloads fd
     WHERE fd.beatmaker_id = p_beatmaker_id
       AND (p_de IS NULL OR fd.downloaded_at >= p_de)
       AND (p_a  IS NULL OR fd.downloaded_at <= p_a)
    UNION ALL
    SELECT fa.beat_id, 0, NULL, 0, 1
      FROM favoris fa
      JOIN beats b ON b.id = fa.beat_id
     WHERE b.beatmaker_id = p_beatmaker_id
       AND (p_de IS NULL OR fa.created_at >= p_de)
       AND (p_a  IS NULL OR fa.created_at <= p_a)
  )
  SELECT ev.beat_id,
         sum(ev.e)::bigint,
         coalesce(sum(ev.d), 0)::bigint,
         count(ev.d)::bigint,
         sum(ev.f)::bigint,
         sum(ev.v)::bigint
    FROM ev
   GROUP BY ev.beat_id
   ORDER BY ev.beat_id
$$;

-- Comptes par tranche (jour / semaine du lundi / mois) dans le fuseau du
-- beatmaker, pour les graphiques. [p_de, p_a[ = du début de la 1re tranche à
-- la fin de la dernière. p_par_beat = false → une ligne par tranche (beat_id null).
CREATE OR REPLACE FUNCTION analytics_evenements_par_tranche(
  p_beatmaker_id uuid,
  p_fuseau       text,
  p_granularite  text,
  p_de           timestamptz,
  p_a            timestamptz,
  p_par_beat     boolean
) RETURNS TABLE (tranche date, beat_id uuid, ecoutes bigint, free_dl bigint, favoris bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH ev AS (
    SELECT p.beat_id, p.played_at AS t, 1 AS e, 0 AS f, 0 AS v
      FROM beat_plays p
     WHERE p.beatmaker_id = p_beatmaker_id AND p.played_at >= p_de AND p.played_at < p_a
    UNION ALL
    SELECT fd.beat_id, fd.downloaded_at, 0, 1, 0
      FROM free_downloads fd
     WHERE fd.beatmaker_id = p_beatmaker_id AND fd.downloaded_at >= p_de AND fd.downloaded_at < p_a
    UNION ALL
    SELECT fa.beat_id, fa.created_at, 0, 0, 1
      FROM favoris fa
      JOIN beats b ON b.id = fa.beat_id
     WHERE b.beatmaker_id = p_beatmaker_id AND fa.created_at >= p_de AND fa.created_at < p_a
  )
  SELECT date_trunc(
           CASE p_granularite WHEN 'jours' THEN 'day' WHEN 'semaines' THEN 'week' WHEN 'mois' THEN 'month' END,
           ev.t AT TIME ZONE p_fuseau
         )::date AS tranche,
         CASE WHEN p_par_beat THEN ev.beat_id END AS beat_id,
         sum(ev.e)::bigint,
         sum(ev.f)::bigint,
         sum(ev.v)::bigint
    FROM ev
   GROUP BY 1, 2
   ORDER BY 1, 2
$$;

-- Écoutes par beat sur toute la plateforme (page admin Catégories).
CREATE OR REPLACE FUNCTION analytics_ecoutes_par_beat_plateforme()
RETURNS TABLE (beat_id uuid, ecoutes bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.beat_id, count(*)::bigint FROM beat_plays p GROUP BY p.beat_id ORDER BY p.beat_id
$$;

REVOKE ALL ON FUNCTION analytics_evenements_par_beat(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_evenements_par_tranche(uuid, text, text, timestamptz, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_ecoutes_par_beat_plateforme() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_evenements_par_beat(uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_evenements_par_tranche(uuid, text, text, timestamptz, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_ecoutes_par_beat_plateforme() TO service_role;

COMMIT;

-- ─── SELECT de contrôle (à lancer après) ──────────────────────────────────────
-- 1. Les 3 fonctions existent :
-- SELECT proname, pg_get_function_identity_arguments(oid) AS parametres FROM pg_proc WHERE proname LIKE 'analytics_%' ORDER BY proname;
-- 2. Seul service_role peut les exécuter (aucune ligne anon / authenticated / PUBLIC) :
-- SELECT p.proname, r.rolname FROM pg_proc p CROSS JOIN pg_roles r
--  WHERE p.proname LIKE 'analytics_%' AND r.rolname IN ('anon', 'authenticated', 'service_role')
--    AND has_function_privilege(r.rolname, p.oid, 'EXECUTE') ORDER BY 1, 2;
-- 3. Les 3 index existent :
-- SELECT indexname FROM pg_indexes WHERE indexname IN ('beat_plays_beatmaker_played_idx', 'free_downloads_beatmaker_download_idx', 'favoris_beat_idx');
-- 4. Fonction = comptage direct (jakeb-test) :
-- WITH b AS (SELECT id FROM beatmakers WHERE slug = 'jakeb-test')
-- SELECT (SELECT sum(ecoutes) FROM analytics_evenements_par_beat((SELECT id FROM b), NULL, NULL)) AS ecoutes_fonction,
--        (SELECT count(*) FROM beat_plays WHERE beatmaker_id = (SELECT id FROM b))                AS ecoutes_direct,
--        (SELECT sum(free_dl) FROM analytics_evenements_par_beat((SELECT id FROM b), NULL, NULL)) AS free_dl_fonction,
--        (SELECT count(*) FROM free_downloads WHERE beatmaker_id = (SELECT id FROM b))            AS free_dl_direct,
--        (SELECT sum(favoris) FROM analytics_evenements_par_beat((SELECT id FROM b), NULL, NULL)) AS favoris_fonction,
--        (SELECT count(*) FROM favoris fa JOIN beats be ON be.id = fa.beat_id WHERE be.beatmaker_id = (SELECT id FROM b)) AS favoris_direct;
