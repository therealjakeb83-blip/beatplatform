-- ============================================================
-- PHASE 5 — Marketing : Automatisations
-- ============================================================
-- 3 tables : la config de chaque recette (automatisations), la file
-- d'attente des événements déclencheurs (automatisation_evenements),
-- et le log d'envoi anti-doublon (automatisation_envois).
-- Voir memory/project_phase5_automatisations_redesign.md et
-- ROADMAP.md (11d Phase 5) pour le détail des 8 recettes prévues.
-- Construites une par une : seul le type 'bienvenue_abonnement'
-- est actif pour l'instant, les autres viendront par migration
-- additive sur le CHECK (pas de réécriture de la table).

-- ============================================================
-- 1. TABLE : automatisations
--    Une ligne par recette activée/configurée par un beatmaker
-- ============================================================

CREATE TABLE IF NOT EXISTS automatisations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  type          text        NOT NULL CHECK (type IN ('bienvenue_abonnement')),
  actif         boolean     NOT NULL DEFAULT true,
  delai_jours   integer     NOT NULL DEFAULT 1,
  objet         text,
  corps         text,
  config        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (beatmaker_id, type)
);

ALTER TABLE automatisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automatisations_select" ON automatisations
  FOR SELECT USING (beatmaker_id = auth.uid());
CREATE POLICY "automatisations_insert" ON automatisations
  FOR INSERT WITH CHECK (beatmaker_id = auth.uid());
CREATE POLICY "automatisations_update" ON automatisations
  FOR UPDATE USING (beatmaker_id = auth.uid());
CREATE POLICY "automatisations_delete" ON automatisations
  FOR DELETE USING (beatmaker_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON automatisations TO authenticated;
GRANT ALL ON automatisations TO service_role;


-- ============================================================
-- 2. TABLE : automatisation_evenements
--    File d'attente déposée par le webhook Stripe (ou tout futur
--    point d'entrée) dès qu'un événement déclencheur a lieu. Le
--    cron quotidien la vide le lendemain (délai J+1 voulu par Jake).
-- ============================================================

CREATE TABLE IF NOT EXISTS automatisation_evenements (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  client_id     uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type          text        NOT NULL CHECK (type IN ('abonnement_bienvenue')),
  reference_id  uuid        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  traite        boolean     NOT NULL DEFAULT false,
  UNIQUE (type, reference_id)
);

CREATE INDEX IF NOT EXISTS automatisation_evenements_traite_idx
  ON automatisation_evenements (traite, created_at);

ALTER TABLE automatisation_evenements ENABLE ROW LEVEL SECURITY;

-- Écriture toujours via createAdminClient() (webhook + cron) — pas de policy
-- INSERT/UPDATE authenticated nécessaire.
CREATE POLICY "automatisation_evenements_select" ON automatisation_evenements
  FOR SELECT USING (beatmaker_id = auth.uid());

GRANT SELECT ON automatisation_evenements TO authenticated;
GRANT ALL    ON automatisation_evenements TO service_role;


-- ============================================================
-- 3. TABLE : automatisation_envois
--    Un email envoyé = une ligne (historique + anti-doublon final)
-- ============================================================

CREATE TABLE IF NOT EXISTS automatisation_envois (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  automatisation_id  uuid        NOT NULL REFERENCES automatisations(id) ON DELETE CASCADE,
  client_id          uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  evenement_cle      text        NOT NULL,
  resend_message_id  text,
  envoye_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automatisation_id, evenement_cle)
);

CREATE INDEX IF NOT EXISTS automatisation_envois_automatisation_idx ON automatisation_envois (automatisation_id);
CREATE INDEX IF NOT EXISTS automatisation_envois_client_idx         ON automatisation_envois (client_id);

ALTER TABLE automatisation_envois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automatisation_envois_select" ON automatisation_envois
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM automatisations a
      WHERE a.id = automatisation_id AND a.beatmaker_id = auth.uid()
    )
  );

GRANT SELECT ON automatisation_envois TO authenticated;
GRANT ALL    ON automatisation_envois TO service_role;
