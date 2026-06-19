-- ============================================================
-- TABLE : licence_downloads
-- Historique des téléchargements de fichiers payants
-- Loggué au clic sur les boutons de la page /telechargement/[commandeId]
-- ============================================================

CREATE TABLE IF NOT EXISTS licence_downloads (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id  uuid        NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  beatmaker_id uuid        NOT NULL,
  client_id    uuid        REFERENCES clients(id),
  fichier      text        NOT NULL,  -- ex: 'MP3 (sans tag)', 'WAV', 'Stems (ZIP)', 'Contrat PDF', 'email_renvoi'
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licence_downloads_commande_idx ON licence_downloads (commande_id);
CREATE INDEX IF NOT EXISTS licence_downloads_beatmaker_idx ON licence_downloads (beatmaker_id);

ALTER TABLE licence_downloads ENABLE ROW LEVEL SECURITY;

-- Le beatmaker voit tous les téléchargements de ses commandes
CREATE POLICY "licence_downloads_beatmaker_own" ON licence_downloads
  FOR ALL USING (auth.uid() = beatmaker_id);

GRANT SELECT, INSERT ON licence_downloads TO authenticated;
