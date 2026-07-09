-- ============================================================
-- PHASE 2c — Fix : grant manquant sur beat_licences
-- ============================================================
-- Le checkout panier lit beat_licences via createAdminClient() (service_role)
-- pour batcher plusieurs beats en une requête — beat_licences.sql n'accordait
-- SELECT qu'à `authenticated` (l'ancien flow single-item lisait cette table
-- avec le client utilisateur, jamais avec le client admin).

grant select on public.beat_licences to service_role;
