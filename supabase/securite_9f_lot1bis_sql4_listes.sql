-- Lot 1 bis, S7 : même appartenance que clientsLiesNonEffaces.
-- USING permet encore de retirer une ancienne entrée devenue invalide.
BEGIN;
DROP POLICY IF EXISTS "beatmaker voit ses listes contacts" ON public.listes_crm_contacts;
CREATE POLICY "beatmaker voit ses listes contacts" ON public.listes_crm_contacts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listes_crm l WHERE l.id = liste_id AND l.beatmaker_id = auth.uid()
  ))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.listes_crm l WHERE l.id = liste_id AND l.beatmaker_id = auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.leads l WHERE l.client_id = listes_crm_contacts.client_id AND l.beatmaker_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.commandes c WHERE c.client_id = listes_crm_contacts.client_id AND c.beatmaker_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.abonnements_boutique a WHERE a.client_id = listes_crm_contacts.client_id AND a.beatmaker_id = auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.leads l WHERE l.client_id = listes_crm_contacts.client_id
        AND l.beatmaker_id = auth.uid() AND l.efface_le IS NOT NULL
    )
  );
COMMIT;
