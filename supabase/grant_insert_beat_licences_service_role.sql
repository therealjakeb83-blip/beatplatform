-- Même trou que grant_insert_beats_service_role.sql : service_role n'a aucun
-- grant sur public.beat_licences (absent de service_role_grants.sql), et n'a que
-- SELECT sur public.beatmakers (pas UPDATE). Nécessaire pour terminer l'import
-- de démo (activer les licences sur les 20 beats Nafaz + mettre à jour le
-- nom_artiste/logo_url de jakeb-test1).

GRANT SELECT, INSERT ON public.beat_licences TO service_role;
GRANT UPDATE ON public.beatmakers TO service_role;
