-- ============================================================
-- Journal des décisions commerciales/juridiques (Phase 7 du chantier 9 bis)
-- ============================================================
-- Preuve de la séparation des rôles (le beatmaker décide, My Producer
-- exécute) — PAS un log technique universel. N'y entrent que des décisions
-- à portée commerciale ou juridique (remboursement, suspension de boutique,
-- publication de CGV, modification d'un texte de licence...). Les
-- webhooks/retries/erreurs techniques restent dans l'observabilité de la
-- Phase 5 (stripe_events, statut_livraison) — voir memory
-- project_grillme_9bis_synthese.
--
-- Append-only : aucune policy UPDATE/DELETE pour authenticated, et aucune
-- pour service_role non plus (GRANT limité à SELECT/INSERT) — même l'admin
-- via createAdminClient() ne peut jamais modifier ou supprimer une ligne
-- une fois écrite, seulement en ajouter une nouvelle.

CREATE TABLE IF NOT EXISTS merchant_decisions_log (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Boutique concernée par la décision (scope de filtrage/RLS) — pas
  -- forcément l'auteur de l'action (ex : suspension décidée par l'admin).
  beatmaker_id       uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  actor_type         text        NOT NULL CHECK (actor_type IN ('beatmaker', 'admin')),
  actor_id           uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  entity_type        text        NOT NULL CHECK (entity_type IN ('commande', 'boutique', 'page_legale', 'licence_texte')),
  entity_id          uuid        NOT NULL,
  action             text        NOT NULL,
  motif              text,
  reference_version  text,
  details            jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_decisions_log_beatmaker_created_idx ON merchant_decisions_log (beatmaker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_decisions_log_entity_idx            ON merchant_decisions_log (entity_type, entity_id);

ALTER TABLE merchant_decisions_log ENABLE ROW LEVEL SECURITY;

-- Le beatmaker voit le journal de sa propre boutique. L'admin consulte
-- n'importe quelle boutique via createAdminClient() (service_role bypasse
-- RLS) dans une route qui valide estAdmin() manuellement — même pattern que
-- stripe_events/email_logs.
CREATE POLICY "merchant_decisions_log_select" ON merchant_decisions_log
  FOR SELECT USING (beatmaker_id = auth.uid());

GRANT SELECT             ON merchant_decisions_log TO authenticated;
GRANT SELECT, INSERT     ON merchant_decisions_log TO service_role;
