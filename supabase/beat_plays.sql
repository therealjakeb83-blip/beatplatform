-- Table pour tracker les écoutes de beats (30 secondes minimum côté client)
CREATE TABLE IF NOT EXISTS beat_plays (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id       uuid         NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  beatmaker_id  uuid         NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  client_id     uuid         REFERENCES clients(id) ON DELETE SET NULL,
  played_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beat_plays_beat_id_idx      ON beat_plays(beat_id);
CREATE INDEX IF NOT EXISTS beat_plays_beatmaker_id_idx ON beat_plays(beatmaker_id);
CREATE INDEX IF NOT EXISTS beat_plays_played_at_idx    ON beat_plays(played_at);

ALTER TABLE beat_plays ENABLE ROW LEVEL SECURITY;

-- Insertion publique : la boutique est accessible sans auth
CREATE POLICY "beat_plays_insert_anon" ON beat_plays
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "beat_plays_insert_auth" ON beat_plays
  FOR INSERT TO authenticated WITH CHECK (true);

-- Lecture : uniquement par le beatmaker propriétaire
CREATE POLICY "beat_plays_select_beatmaker" ON beat_plays
  FOR SELECT TO authenticated
  USING (beatmaker_id = auth.uid());

GRANT INSERT ON beat_plays TO anon, authenticated;
GRANT SELECT ON beat_plays TO authenticated;
GRANT ALL   ON beat_plays TO service_role;
