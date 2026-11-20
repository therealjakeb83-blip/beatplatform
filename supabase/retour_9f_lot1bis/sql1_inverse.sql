-- Retour uniquement sur demande : rouvrira les droits/regles precedents.
-- Etat reel releve par Jake le 20 novembre 2026, avant application du Lot 1 bis.
BEGIN;
DROP POLICY IF EXISTS licences_textes_beatmaker_own ON public.licences_textes;
CREATE POLICY licences_textes_beatmaker_own ON public.licences_textes AS PERMISSIVE FOR ALL TO PUBLIC USING ((beatmaker_id = auth.uid()));
DROP POLICY IF EXISTS licences_textes_historique_beatmaker_insert ON public.licences_textes_historique;
CREATE POLICY licences_textes_historique_beatmaker_insert ON public.licences_textes_historique AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((beatmaker_id = auth.uid()));
DROP POLICY IF EXISTS licences_textes_historique_beatmaker_own ON public.licences_textes_historique;
CREATE POLICY licences_textes_historique_beatmaker_own ON public.licences_textes_historique AS PERMISSIVE FOR SELECT TO PUBLIC USING ((beatmaker_id = auth.uid()));
COMMIT;
