-- Lot 1 bis, S10. Après relevé T0 et essai PGlite. Une transaction seulement.
BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.licences_textes t JOIN public.licences l ON l.id = t.licence_id WHERE t.beatmaker_id <> l.beatmaker_id)
    OR EXISTS (SELECT 1 FROM public.licences_textes_historique t JOIN public.licences l ON l.id = t.licence_id WHERE t.beatmaker_id <> l.beatmaker_id)
  THEN RAISE EXCEPTION 'S10 : texte rattaché à un autre vendeur. Arrêt, faire examiner avant correction ; aucune suppression automatique.';
  END IF;
END $$;

DROP POLICY IF EXISTS licences_textes_beatmaker_own ON public.licences_textes;
CREATE POLICY licences_textes_beatmaker_own ON public.licences_textes
  FOR ALL TO authenticated
  USING (beatmaker_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.licences l WHERE l.id = licence_id AND l.beatmaker_id = auth.uid()
  ))
  WITH CHECK (beatmaker_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.licences l WHERE l.id = licence_id AND l.beatmaker_id = auth.uid()
  ));

-- Même relation dans l'archive : le propriétaire déclaré ne suffit pas.
DROP POLICY IF EXISTS licences_textes_historique_beatmaker_own ON public.licences_textes_historique;
CREATE POLICY licences_textes_historique_beatmaker_own ON public.licences_textes_historique
  FOR SELECT TO authenticated USING (beatmaker_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.licences l WHERE l.id = licence_id AND l.beatmaker_id = auth.uid()
  ));
DROP POLICY IF EXISTS licences_textes_historique_beatmaker_insert ON public.licences_textes_historique;
CREATE POLICY licences_textes_historique_beatmaker_insert ON public.licences_textes_historique
  FOR INSERT TO authenticated WITH CHECK (beatmaker_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.licences l WHERE l.id = licence_id AND l.beatmaker_id = auth.uid()
  ));

COMMIT;
