-- ============================================================
-- Étape 11b — Résolution client par email
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- 1. Supprimer le FK clients.id → auth.users.id
--    Permet de créer des clients invités sans compte Supabase Auth
ALTER TABLE clients DROP CONSTRAINT clients_id_fkey;

-- 2. Rendre prenom nullable
--    Les clients invités n'ont qu'un nom complet depuis Stripe
ALTER TABLE clients ALTER COLUMN prenom DROP NOT NULL;
