-- Rang 9f, Lot 1 — SQL 2 (2026-11-20) : décision 1, tables `beats` et `beatmakers`
-- FERMÉES aux visiteurs et aux comptes artistes (comme les autres tables).
-- La boutique lit côté serveur (clé de service, colonnes affichées seulement) ;
-- le beatmaker garde SA ligne et SES beats (politiques *_select_own conservées).
-- À exécuter APRÈS le déploiement du code du Lot 1 (lecture serveur partout).

BEGIN;

DROP POLICY IF EXISTS beats_select_public ON public.beats;
DROP POLICY IF EXISTS beats_select_prive_meta ON public.beats;
DROP POLICY IF EXISTS beats_select_public_authenticated ON public.beats;
DROP POLICY IF EXISTS beatmakers_select_public ON public.beatmakers;

REVOKE ALL ON public.beats FROM anon;
REVOKE ALL ON public.beatmakers FROM anon;

COMMIT;

-- ─── Vérification (nouvel onglet) ───
-- select
--   has_table_privilege('anon', 'public.beats', 'SELECT') as visiteur_lit_beats,
--   has_table_privilege('anon', 'public.beatmakers', 'SELECT') as visiteur_lit_beatmakers,
--   (select string_agg(policyname, ', ' order by policyname) from pg_policies where tablename = 'beats' and cmd = 'SELECT') as lecture_beats,
--   (select string_agg(policyname, ', ' order by policyname) from pg_policies where tablename = 'beatmakers' and cmd = 'SELECT') as lecture_beatmakers;
-- Attendu : false | false | beats_select_own | beatmakers_select_own

-- ─── Pour défaire (SQL inverse) ───
-- BEGIN;
-- GRANT SELECT ON public.beats TO anon;
-- GRANT SELECT ON public.beatmakers TO anon;
-- CREATE POLICY beats_select_public ON public.beats FOR SELECT TO anon USING ((statut = 'public') AND (supprime_le IS NULL));
-- CREATE POLICY beats_select_prive_meta ON public.beats FOR SELECT TO anon USING ((statut = 'prive') AND (supprime_le IS NULL));
-- CREATE POLICY beats_select_public_authenticated ON public.beats FOR SELECT TO authenticated USING ((statut = ANY (ARRAY['public', 'prive'])) AND (supprime_le IS NULL));
-- CREATE POLICY beatmakers_select_public ON public.beatmakers FOR SELECT TO anon USING (true);
-- COMMIT;
