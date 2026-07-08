-- ============================================================
-- Étendre tentatives_paiement aux échecs de renouvellement d'abonnement
-- ============================================================
-- Jusqu'ici, un échec de renouvellement (invoice.payment_failed) ne laissait
-- aucune trace : pas de commande (rien n'a été payé), pas de tentative non
-- plus (cette table ne couvrait que les achats de beat). Réutilise le même
-- modèle plutôt que d'en créer une nouvelle table — migration additive, les
-- lignes existantes (achats de beat) restent valides telles quelles.

ALTER TABLE tentatives_paiement ALTER COLUMN beat_id DROP NOT NULL;
ALTER TABLE tentatives_paiement ALTER COLUMN licence_id DROP NOT NULL;
ALTER TABLE tentatives_paiement ALTER COLUMN stripe_session_id DROP NOT NULL;

ALTER TABLE tentatives_paiement ADD COLUMN type text NOT NULL DEFAULT 'achat_beat'
  CHECK (type IN ('achat_beat', 'renouvellement_abonnement'));

ALTER TABLE tentatives_paiement ADD COLUMN abonnement_id uuid REFERENCES abonnements_boutique(id) ON DELETE CASCADE;
ALTER TABLE tentatives_paiement ADD COLUMN stripe_invoice_id text UNIQUE;

-- Un achat de beat a beat_id/licence_id/stripe_session_id et pas d'abonnement ;
-- un renouvellement a abonnement_id/stripe_invoice_id et rien de l'achat de beat
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_forme_coherente CHECK (
  (type = 'achat_beat' AND beat_id IS NOT NULL AND licence_id IS NOT NULL AND stripe_session_id IS NOT NULL
    AND abonnement_id IS NULL AND stripe_invoice_id IS NULL)
  OR
  (type = 'renouvellement_abonnement' AND abonnement_id IS NOT NULL AND stripe_invoice_id IS NOT NULL
    AND beat_id IS NULL AND licence_id IS NULL AND stripe_session_id IS NULL)
);

CREATE INDEX ON tentatives_paiement (abonnement_id);
