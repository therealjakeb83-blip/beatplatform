-- Listes statiques CRM (l'utilisateur choisit manuellement les contacts)
CREATE TABLE IF NOT EXISTS listes_crm (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  beatmaker_id uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  nom          text NOT NULL,
  description  text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE listes_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beatmaker voit ses listes" ON listes_crm
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON listes_crm TO authenticated;

-- Membres d'une liste (liaison N-N)
CREATE TABLE IF NOT EXISTS listes_crm_contacts (
  liste_id  uuid NOT NULL REFERENCES listes_crm(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  added_at  timestamptz DEFAULT now(),
  PRIMARY KEY (liste_id, client_id)
);

ALTER TABLE listes_crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beatmaker voit ses listes contacts" ON listes_crm_contacts
  FOR ALL USING (
    liste_id IN (SELECT id FROM listes_crm WHERE beatmaker_id = auth.uid())
  );

GRANT ALL ON listes_crm_contacts TO authenticated;
