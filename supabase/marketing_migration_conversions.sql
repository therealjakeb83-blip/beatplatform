-- ============================================================
-- Étape 11d — Phase 4 : Marketing — suivi des conversions
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

-- Marque quand un destinataire de campagne a effectué un achat après l'avoir reçue
-- (évite de compter deux fois le même client sur la même campagne)
ALTER TABLE campagne_envois ADD COLUMN IF NOT EXISTS converti_at timestamptz;
