-- ============================================================
-- Étape 9 — Espace client artiste
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- RLS sur la table clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Suppression des policies clients/abonnements/commandes existantes
DROP POLICY IF EXISTS "clients_select_own" ON clients;
DROP POLICY IF EXISTS "clients_update_own" ON clients;
DROP POLICY IF EXISTS "clients_insert_own" ON clients;
DROP POLICY IF EXISTS "abonnements_boutique_select_client" ON abonnements_boutique;
DROP POLICY IF EXISTS "commandes_select_client" ON commandes;

-- Les clients peuvent lire leur propre profil
CREATE POLICY "clients_select_own" ON clients
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Les clients peuvent mettre à jour leur propre profil
CREATE POLICY "clients_update_own" ON clients
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- Les clients peuvent insérer leur propre ligne (à la création de compte)
CREATE POLICY "clients_insert_own" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Les clients peuvent voir leurs propres abonnements boutique
CREATE POLICY "abonnements_boutique_select_client" ON abonnements_boutique
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Les clients peuvent voir leurs propres commandes
CREATE POLICY "commandes_select_client" ON commandes
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- ============================================================
-- TABLE : favoris
-- Beats likés par les artistes acheteurs
-- ============================================================
CREATE TABLE IF NOT EXISTS favoris (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  beat_id    UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, beat_id)
);

ALTER TABLE favoris ENABLE ROW LEVEL SECURITY;

-- Suppression des policies favoris si la table existait déjà
DROP POLICY IF EXISTS "favoris_select_own" ON favoris;
DROP POLICY IF EXISTS "favoris_insert_own" ON favoris;
DROP POLICY IF EXISTS "favoris_delete_own" ON favoris;

CREATE POLICY "favoris_select_own" ON favoris
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "favoris_insert_own" ON favoris
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "favoris_delete_own" ON favoris
  FOR DELETE TO authenticated
  USING (client_id = auth.uid());

-- Accès service_role pour les opérations admin
GRANT SELECT, INSERT, UPDATE, DELETE ON favoris TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO service_role;
