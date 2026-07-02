-- ============================================================
-- Étape 11d — Phase 4.6 : Webhook Resend (tracking + désinscription)
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

ALTER TABLE campagne_envois ADD COLUMN IF NOT EXISTS desinscrit_at timestamptz;
