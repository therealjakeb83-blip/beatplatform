CREATE TABLE IF NOT EXISTS segments_crm (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  beatmaker_id uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  nom          text NOT NULL,
  description  text,
  couleur      text NOT NULL DEFAULT 'indigo',
  filtres      jsonb NOT NULL DEFAULT '[]',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE segments_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beatmaker voit ses segments" ON segments_crm
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON segments_crm TO authenticated;
