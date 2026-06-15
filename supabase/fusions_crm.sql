-- ── Table fusions_crm ────────────────────────────────────────────────────────
-- Fusion virtuelle CRM : enregistre qu'un contact archivé = un contact conservé
-- Aucune donnée n'est déplacée — la lecture fusionne les deux client_ids

CREATE TABLE IF NOT EXISTS fusions_crm (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id        uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  client_id_conserve  uuid        NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,
  client_id_archive   uuid        NOT NULL REFERENCES clients(id)    ON DELETE CASCADE,

  -- Emails secondaires (email(s) du contact archivé)
  emails_archives     text[]      NOT NULL DEFAULT '{}',

  -- Valeurs retenues pour les champs en conflit (overrides sur le contact conservé)
  -- Ex: { "telephone": "+33 6 12 34 56", "pays": "fr", "instagram": "@jake" }
  champs_conserves    jsonb       NOT NULL DEFAULT '{}',

  -- Snapshot du contact archivé au moment de la fusion (pour l'historique)
  -- Ex: { "prenom": "Nicolas", "nom": "Artiste", "email": "...", "ltv": 215, "nb_achats": 7 }
  snapshot_archive    jsonb       NOT NULL DEFAULT '{}',

  -- Raisons de la détection (pour affichage dans l'historique)
  -- Ex: [{ "champ": "email", "type": "similaire", "score": 0.86 }]
  raisons             jsonb       NOT NULL DEFAULT '[]',

  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Un contact ne peut être archivé qu'une seule fois par beatmaker
  UNIQUE (beatmaker_id, client_id_archive),
  -- Un contact ne peut pas être à la fois conservé et archivé
  CHECK (client_id_conserve <> client_id_archive)
);

-- Index
CREATE INDEX IF NOT EXISTS fusions_crm_beatmaker_idx  ON fusions_crm (beatmaker_id);
CREATE INDEX IF NOT EXISTS fusions_crm_conserve_idx   ON fusions_crm (client_id_conserve);
CREATE INDEX IF NOT EXISTS fusions_crm_archive_idx    ON fusions_crm (client_id_archive);

-- RLS
ALTER TABLE fusions_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY fusions_crm_select ON fusions_crm FOR SELECT
  USING (beatmaker_id = auth.uid());

CREATE POLICY fusions_crm_insert ON fusions_crm FOR INSERT
  WITH CHECK (beatmaker_id = auth.uid());

CREATE POLICY fusions_crm_delete ON fusions_crm FOR DELETE
  USING (beatmaker_id = auth.uid());

-- GRANTs
GRANT SELECT, INSERT, DELETE ON fusions_crm TO authenticated;
GRANT ALL ON fusions_crm TO service_role;
