-- Étape 11 — CRM
-- Rendre beat_id et licence_id nullable dans commandes
-- Nécessaire pour stocker les imports BeatStars sans beat correspondant
ALTER TABLE commandes ALTER COLUMN beat_id DROP NOT NULL;
ALTER TABLE commandes ALTER COLUMN licence_id DROP NOT NULL;

-- RLS : permettre aux beatmakers de lire/écrire leurs propres doublons_ignores
ALTER TABLE doublons_ignores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doublons_ignores_beatmaker"
  ON doublons_ignores
  FOR ALL
  USING (beatmaker_id = auth.uid())
  WITH CHECK (beatmaker_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON doublons_ignores TO authenticated;
