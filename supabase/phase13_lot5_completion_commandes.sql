-- ============================================================
-- PHASE 13 — LOT 5 (E10) : réparation automatique des commandes incomplètes
-- (contrat, facture, avoir ou frais Stripe manquant après une panne).
--
-- À exécuter AVANT de pousser le code du lot 5 (le nouveau code lit ces
-- colonnes). Une seule transaction : tout ou rien.
--
-- Rien n'est modifié dans les données existantes : 3 colonnes ajoutées
-- (vides / à 0) + 1 index partiel.
-- ============================================================

BEGIN;

-- Suivi des essais de la tâche de nuit (alerte au bout de 3 nuits, une fois).
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS completion_tentatives integer NOT NULL DEFAULT 0;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS completion_derniere_tentative_at timestamptz;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS completion_alerte_at timestamptz;

-- La « pile à réparer » : seules les commandes non livrées sont dans cet
-- index, la tâche de nuit ne relit jamais les commandes saines.
CREATE INDEX IF NOT EXISTS commandes_a_completer_idx
  ON commandes (completion_derniere_tentative_at NULLS FIRST, created_at)
  WHERE statut_livraison <> 'livree';

COMMIT;

-- ------------------------------------------------------------
-- VÉRIFICATION (lecture seule) — à lancer après :
-- ------------------------------------------------------------
-- select column_name, data_type, column_default from information_schema.columns
--  where table_name = 'commandes'
--    and column_name in ('completion_tentatives', 'completion_derniere_tentative_at', 'completion_alerte_at');   -- 3 lignes
-- select indexname from pg_indexes where indexname = 'commandes_a_completer_idx';                             -- 1 ligne
