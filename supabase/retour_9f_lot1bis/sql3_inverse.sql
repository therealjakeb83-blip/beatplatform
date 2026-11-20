-- Retour uniquement sur demande : rouvrira les droits/regles precedents.
-- Etat reel releve par Jake le 20 novembre 2026, avant application du Lot 1 bis.
BEGIN;
DROP POLICY IF EXISTS categories_delete ON public.categories;
CREATE POLICY categories_delete ON public.categories AS PERMISSIVE FOR DELETE TO PUBLIC USING (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text) AND (statut = 'active'::text)));
DROP POLICY IF EXISTS categories_insert ON public.categories;
CREATE POLICY categories_insert ON public.categories AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text)));
DROP POLICY IF EXISTS categories_update ON public.categories;
CREATE POLICY categories_update ON public.categories AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text))) WITH CHECK (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text) AND (statut = ANY (ARRAY['active'::text, 'en_attente_certification'::text]))));
COMMIT;
