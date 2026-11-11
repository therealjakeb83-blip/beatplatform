-- Rang 9c, lot 3 (2026-11-11) : emails de compte des clients artistes envoyés par Sonoo.
-- Ces emails (confirme ton compte, mot de passe oublié) contiennent un lien de
-- connexion : ils sont enregistrés SANS boutique (beatmaker_id vide) pour que le
-- beatmaker ne les voie jamais dans son journal, et le lien y est masqué.
-- L'index sert au garde-fou « un email du même type par minute et par adresse ».

BEGIN;

ALTER TABLE email_logs ALTER COLUMN beatmaker_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS email_logs_destinataire_evenement_idx
  ON email_logs (destinataire, evenement, created_at DESC);

COMMIT;
