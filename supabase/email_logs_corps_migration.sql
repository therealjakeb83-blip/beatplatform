-- ============================================================
-- Logs emails — stocker le corps réellement envoyé
-- ============================================================
-- Permet d'afficher l'email tel qu'il a été envoyé (aperçu + code
-- source), comme WP Mail Logging. html et texte sont mutuellement
-- exclusifs selon le point d'envoi (voir lib/email-logger.ts).

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS corps_html   text;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS corps_texte  text;
