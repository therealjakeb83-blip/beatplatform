-- Lot 1 bis, S2/S3. Le workflow de certification vit dans demandes_certification.
BEGIN;
DROP POLICY IF EXISTS categories_insert ON public.categories;
CREATE POLICY categories_insert ON public.categories FOR INSERT TO authenticated
  WITH CHECK (beatmaker_id = auth.uid() AND source = 'beatmaker'
    AND statut = 'active' AND type IN ('styles', 'type_beat'));
DROP POLICY IF EXISTS categories_update ON public.categories;
CREATE POLICY categories_update ON public.categories FOR UPDATE TO authenticated
  USING (beatmaker_id = auth.uid() AND source = 'beatmaker'
    AND statut = 'active' AND type IN ('styles', 'type_beat'))
  WITH CHECK (beatmaker_id = auth.uid() AND source = 'beatmaker'
    AND statut = 'active' AND type IN ('styles', 'type_beat'));
DROP POLICY IF EXISTS categories_delete ON public.categories;
CREATE POLICY categories_delete ON public.categories FOR DELETE TO authenticated
  USING (beatmaker_id = auth.uid() AND source = 'beatmaker'
    AND statut = 'active' AND type IN ('styles', 'type_beat'));
COMMIT;
