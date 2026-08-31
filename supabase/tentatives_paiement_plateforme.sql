-- ============================================================
-- Étendre tentatives_paiement aux échecs de l'abonnement PLATEFORME
-- ============================================================
-- Rang 9 ROADMAP (dernier point des "petits trous fonctionnels avant
-- lancement") : un échec de renouvellement de l'abonnement plateforme
-- (beatmaker → My Producer, table abonnements_plateforme) n'était tracé
-- nulle part — traiterEchecRenouvellementAbonnement() ne cherchait que
-- côté abonnements_boutique. Même modèle que
-- supabase/tentatives_paiement_abonnement.sql (réutilise tentatives_paiement
-- plutôt qu'une nouvelle table), un 3e type ajouté.

ALTER TABLE tentatives_paiement ADD COLUMN abonnement_plateforme_id uuid
  REFERENCES abonnements_plateforme(id) ON DELETE CASCADE;

-- Le CHECK sur `type` a été créé via `ADD COLUMN ... CHECK (...)` (voir
-- tentatives_paiement_abonnement.sql) — son nom est auto-généré par Postgres,
-- pas fiable à deviner. On le retrouve dynamiquement par son contenu plutôt
-- que par un nom en dur.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'tentatives_paiement'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type = ANY%'
  LOOP
    EXECUTE format('ALTER TABLE tentatives_paiement DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_type_check
  CHECK (type IN ('achat_beat', 'renouvellement_abonnement', 'renouvellement_abonnement_plateforme'));

ALTER TABLE tentatives_paiement DROP CONSTRAINT tentatives_paiement_forme_coherente;
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_forme_coherente CHECK (
  (type = 'achat_beat' AND beat_id IS NOT NULL AND licence_id IS NOT NULL AND stripe_session_id IS NOT NULL
    AND abonnement_id IS NULL AND stripe_invoice_id IS NULL AND abonnement_plateforme_id IS NULL)
  OR
  (type = 'renouvellement_abonnement' AND abonnement_id IS NOT NULL AND stripe_invoice_id IS NOT NULL
    AND beat_id IS NULL AND licence_id IS NULL AND stripe_session_id IS NULL AND abonnement_plateforme_id IS NULL)
  OR
  (type = 'renouvellement_abonnement_plateforme' AND abonnement_plateforme_id IS NOT NULL AND stripe_invoice_id IS NOT NULL
    AND beat_id IS NULL AND licence_id IS NULL AND stripe_session_id IS NULL AND abonnement_id IS NULL)
);

CREATE INDEX ON tentatives_paiement (abonnement_plateforme_id);
