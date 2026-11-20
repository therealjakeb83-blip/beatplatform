-- Fixture de test seulement : politiques du relevé Q1 de Jake, 20/11/2026.
-- Ne jamais exécuter ce fichier sur la base en ligne.
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='abonnements_boutique' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'abonnements_boutique'); END LOOP; END $$;
CREATE POLICY "abonnements_boutique_select_beatmaker" ON public."abonnements_boutique" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = beatmaker_id));
CREATE POLICY "abonnements_boutique_select_client" ON public."abonnements_boutique" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((client_id = auth.uid()));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='beat_splits' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'beat_splits'); END LOOP; END $$;
CREATE POLICY "beatmaker gère ses splits" ON public."beat_splits" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM beats
  WHERE ((beats.id = beat_splits.beat_id) AND (beats.beatmaker_id = auth.uid())))));
CREATE POLICY "collab voit ses splits" ON public."beat_splits" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((beatmaker_id = auth.uid()));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='beats' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'beats'); END LOOP; END $$;
CREATE POLICY "beats_delete_own" ON public."beats" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = beatmaker_id));
CREATE POLICY "beats_insert_own" ON public."beats" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = beatmaker_id));
CREATE POLICY "beats_select_own" ON public."beats" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = beatmaker_id));
CREATE POLICY "beats_update_own" ON public."beats" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = beatmaker_id)) WITH CHECK ((auth.uid() = beatmaker_id));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='categories' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'categories'); END LOOP; END $$;
CREATE POLICY "categories_delete" ON public."categories" AS PERMISSIVE FOR DELETE TO PUBLIC USING (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text) AND (statut = 'active'::text)));
CREATE POLICY "categories_insert" ON public."categories" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text)));
CREATE POLICY "categories_select" ON public."categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((source = 'plateforme'::text) OR (beatmaker_id = auth.uid()) OR (statut = 'certifiee'::text)));
CREATE POLICY "categories_update" ON public."categories" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text))) WITH CHECK (((beatmaker_id = auth.uid()) AND (source = 'beatmaker'::text) AND (statut = ANY (ARRAY['active'::text, 'en_attente_certification'::text]))));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='commandes' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'commandes'); END LOOP; END $$;
CREATE POLICY "commandes_select_beatmaker" ON public."commandes" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = beatmaker_id));
CREATE POLICY "commandes_select_client" ON public."commandes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((client_id = auth.uid()));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='leads' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'leads'); END LOOP; END $$;
CREATE POLICY "leads_select_own" ON public."leads" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = beatmaker_id));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='licences' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'licences'); END LOOP; END $$;
CREATE POLICY "licences_delete_own" ON public."licences" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = beatmaker_id));
CREATE POLICY "licences_insert_own" ON public."licences" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = beatmaker_id));
CREATE POLICY "licences_select_own" ON public."licences" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = beatmaker_id));
CREATE POLICY "licences_select_public" ON public."licences" AS PERMISSIVE FOR SELECT TO "anon" USING (true);
CREATE POLICY "licences_select_public_authenticated" ON public."licences" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "licences_update_own" ON public."licences" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = beatmaker_id)) WITH CHECK ((auth.uid() = beatmaker_id));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='licences_textes' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'licences_textes'); END LOOP; END $$;
CREATE POLICY "licences_textes_beatmaker_own" ON public."licences_textes" AS PERMISSIVE FOR ALL TO PUBLIC USING ((beatmaker_id = auth.uid()));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='listes_crm_contacts' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,'listes_crm_contacts'); END LOOP; END $$;
CREATE POLICY "beatmaker voit ses listes contacts" ON public."listes_crm_contacts" AS PERMISSIVE FOR ALL TO PUBLIC USING ((liste_id IN ( SELECT listes_crm.id
   FROM listes_crm
  WHERE (listes_crm.beatmaker_id = auth.uid()))));
