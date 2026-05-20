-- Étape 11 — CRM
-- RLS et permissions pour la table doublons_ignores

ALTER TABLE doublons_ignores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doublons_ignores_beatmaker"
  ON doublons_ignores
  FOR ALL
  USING (beatmaker_id = auth.uid())
  WITH CHECK (beatmaker_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON doublons_ignores TO authenticated;
