-- Retour uniquement sur demande : rouvrira les droits/regles precedents.
-- Etat reel releve par Jake le 20 novembre 2026, avant application du Lot 1 bis.
BEGIN;
DROP POLICY IF EXISTS "beatmaker gère ses splits" ON public.beat_splits;
CREATE POLICY "beatmaker gère ses splits" ON public.beat_splits AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM beats
  WHERE ((beats.id = beat_splits.beat_id) AND (beats.beatmaker_id = auth.uid())))));
GRANT DELETE ON TABLE public.beat_splits TO authenticated;
GRANT INSERT ON TABLE public.beat_splits TO authenticated;
GRANT UPDATE ON TABLE public.beat_splits TO authenticated;
COMMIT;
