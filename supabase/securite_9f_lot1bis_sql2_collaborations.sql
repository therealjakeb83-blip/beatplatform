-- Lot 1 bis, B1/S1. Les transitions légitimes utilisent déjà service_role.
BEGIN;
DROP POLICY IF EXISTS "beatmaker gère ses splits" ON public.beat_splits;
CREATE POLICY "beatmaker gère ses splits" ON public.beat_splits
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.beats b WHERE b.id = beat_id AND b.beatmaker_id = auth.uid()
  ));
REVOKE INSERT, UPDATE, DELETE ON public.beat_splits FROM PUBLIC, anon, authenticated;
-- Un droit de colonne peut survivre au retrait du droit de table.
DO $$
DECLARE colonne record;
BEGIN
  FOR colonne IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.beat_splits'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON public.beat_splits FROM PUBLIC, anon, authenticated', colonne.attname, colonne.attname);
  END LOOP;
END $$;
COMMIT;
