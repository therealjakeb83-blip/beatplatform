-- Import de commandes externes — lot 2, ménage (À EXÉCUTER APRÈS le
-- déploiement du code qui utilise commandes.stripe_invoice_id).
-- Les commandes importées vivent dans commandes_externes : les anciennes
-- colonnes d'import dans commandes ne servent plus à rien.

BEGIN;

ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_plateforme_source_external_order_id_key;
ALTER TABLE commandes DROP COLUMN IF EXISTS external_order_id;
ALTER TABLE commandes DROP COLUMN IF EXISTS plateforme_source;

COMMIT;

-- Contrôle (à lancer après) : 0 ligne attendue
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'commandes'
--   AND column_name IN ('plateforme_source', 'external_order_id');
