-- ============================================================
-- Étape 11d — Phase 4 : Marketing — complément ciblage campagnes
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- (fait suite à marketing_migration.sql, déjà exécuté)
-- ============================================================

-- La colonne `segment_slug` (Phase 0) ne suffit pas : le wizard de création
-- de campagne (4.3) cible par Segment, Liste ou emails saisis à la main.
-- Elle n'est utilisée nulle part dans le code — on la remplace proprement.

ALTER TABLE campagnes DROP COLUMN IF EXISTS segment_slug;

ALTER TABLE campagnes ADD COLUMN IF NOT EXISTS cible_mode   text CHECK (cible_mode IN ('segment', 'liste', 'manuel'));
ALTER TABLE campagnes ADD COLUMN IF NOT EXISTS cible_id     uuid;
ALTER TABLE campagnes ADD COLUMN IF NOT EXISTS cible_emails text[];
