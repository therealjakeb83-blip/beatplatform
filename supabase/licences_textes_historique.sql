-- ============================================================
-- Historique des textes de licence (suite Phase 7, 9 bis)
-- ============================================================
-- Même besoin que boutique_pages_legales_historique (Phase 4) : jusqu'ici
-- licences_textes écrasait le contenu précédent à chaque modification
-- (upsert sur licence_id, seul le numéro de version était incrémenté) —
-- le texte d'une ancienne version était perdu pour toujours. Un texte de
-- licence est un document juridique au même titre que les CGV, mérite le
-- même traitement — déclenché par le besoin d'afficher l'ancien texte dans
-- le journal des décisions commerciales (merchant_decisions_log).

CREATE TABLE IF NOT EXISTS licences_textes_historique (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id    uuid        NOT NULL REFERENCES licences(id) ON DELETE CASCADE,
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  contenu       text        NOT NULL,
  version       integer     NOT NULL,
  archive_le    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licences_textes_historique_idx ON licences_textes_historique (licence_id, version);

ALTER TABLE licences_textes_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licences_textes_historique_beatmaker_own" ON licences_textes_historique
  FOR SELECT USING (beatmaker_id = auth.uid());

CREATE POLICY "licences_textes_historique_beatmaker_insert" ON licences_textes_historique
  FOR INSERT WITH CHECK (beatmaker_id = auth.uid());

GRANT SELECT, INSERT ON licences_textes_historique TO authenticated;
GRANT SELECT, INSERT ON licences_textes_historique TO service_role;

COMMENT ON TABLE licences_textes_historique IS
  'Archive de chaque version remplacée de licences_textes — permet de retrouver le texte exact en vigueur à une date donnée.';
