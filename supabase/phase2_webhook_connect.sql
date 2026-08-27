-- ============================================================
-- PHASE 2 (refonte 9 bis) — Webhook Connect (tâches 2.6/2.7)
-- ============================================================
-- Colonne pour distinguer, dans le log admin existant, les events reçus du
-- nouveau webhook Connect (Direct Charge) de ceux du webhook plateforme
-- (destination charge/abonnements) — utile pour débugger les premiers
-- tests Direct Charge sans deviner la source d'un event.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table stripe_events add column if not exists compte_connecte text;
