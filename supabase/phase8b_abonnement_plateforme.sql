-- ============================================================
-- ÉTAPE 8b — Abonnement plateforme (beatmaker → My Producer)
-- ============================================================
-- La migration phase15_1_admin_support.sql avait déjà accordé SELECT/UPDATE
-- sur abonnements_plateforme à service_role (jamais fait avant) — il manque
-- INSERT, nécessaire pour traiterAbonnementPlateformeCree (webhook).

grant insert on public.abonnements_plateforme to service_role;

-- Une policy RLS "le beatmaker voit son propre abonnement" existe déjà
-- (rls_policies.sql) mais sans grant table-level à authenticated, la requête
-- échoue avant même d'atteindre la policy — nécessaire pour que
-- /dashboard/abonnement (client Supabase RLS, pas admin) puisse lire.
grant select on public.abonnements_plateforme to authenticated;
