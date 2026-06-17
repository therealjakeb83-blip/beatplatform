-- ============================================================
-- Emails secondaires CRM — colonne sur la table clients
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- Permet au beatmaker d'associer des adresses alternatives à un contact
-- (indépendamment des fusions — ce sont des annotations CRM manuelles)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS emails_secondaires text[] NOT NULL DEFAULT '{}';
