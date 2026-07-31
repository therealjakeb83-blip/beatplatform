-- Le service_role n'a que SELECT sur public.beats (service_role_grants.sql, ligne 4).
-- Nécessaire pour l'import ponctuel de démo (20 beats Nafaz sur jakeb-test1) via
-- createAdminClient() côté script Node, qui doit pouvoir insérer des lignes beats.

GRANT INSERT ON public.beats TO service_role;
