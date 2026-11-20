-- Retour uniquement sur demande : rouvrira les droits/regles precedents.
-- Etat reel releve par Jake le 20 novembre 2026, avant application du Lot 1 bis.
BEGIN;
DROP POLICY IF EXISTS "beatmaker voit ses listes contacts" ON public.listes_crm_contacts;
CREATE POLICY "beatmaker voit ses listes contacts" ON public.listes_crm_contacts AS PERMISSIVE FOR ALL TO PUBLIC USING ((liste_id IN ( SELECT listes_crm.id
   FROM listes_crm
  WHERE (listes_crm.beatmaker_id = auth.uid()))));
COMMIT;
