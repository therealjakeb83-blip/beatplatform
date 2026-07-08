-- ============================================================
-- Logs emails — historique unifié de tous les emails envoyés
-- ============================================================
-- Une ligne par email réellement envoyé (succès ou échec), toutes
-- sources confondues : transactionnel (lib/emails.ts), campagnes
-- (lib/mailing.ts), automatisations (lib/automatisations.ts), et
-- toute future source qui passera par lib/email-logger.ts.
--
-- `type` est volontairement restreint (3 sous-systèmes réels), mais
-- `evenement` reste du texte libre : chaque nouveau transactionnel ou
-- chaque nouvelle recette d'automatisation (Phase 5, recettes 2 à 8)
-- n'a besoin d'aucune migration de schéma, juste d'un nouveau libellé.
--
-- Les tables campagne_envois / automatisation_envois existantes ne
-- sont pas remplacées (anti-doublon, compteurs, ouvert_at/clique_at
-- par recette) — email_logs les complète pour donner une vue unifiée.

CREATE TABLE IF NOT EXISTS email_logs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id       uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  destinataire       text        NOT NULL,
  sujet              text        NOT NULL,
  type               text        NOT NULL CHECK (type IN ('transactionnel', 'campagne', 'automatisation')),
  evenement          text        NOT NULL,
  statut             text        NOT NULL CHECK (statut IN ('envoye', 'echoue')),
  erreur             text,
  resend_message_id  text,
  ouvert_at          timestamptz,
  clique_at          timestamptz,
  client_id          uuid        REFERENCES clients(id) ON DELETE SET NULL,
  commande_id        uuid        REFERENCES commandes(id) ON DELETE SET NULL,
  campagne_id        uuid        REFERENCES campagnes(id) ON DELETE SET NULL,
  automatisation_id  uuid        REFERENCES automatisations(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_logs_beatmaker_created_idx ON email_logs (beatmaker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_resend_message_idx    ON email_logs (resend_message_id);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Écriture toujours via createAdminClient() (lib/email-logger.ts) — pas de
-- policy INSERT/UPDATE authenticated nécessaire, cohérent avec le pattern
-- des autres tables de log (automatisation_envois, campagne_envois).
CREATE POLICY "email_logs_select" ON email_logs
  FOR SELECT USING (beatmaker_id = auth.uid());

GRANT SELECT ON email_logs TO authenticated;
GRANT ALL    ON email_logs TO service_role;
