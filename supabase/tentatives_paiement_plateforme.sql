-- ============================================================
-- Étendre tentatives_paiement aux échecs de l'abonnement PLATEFORME
-- ============================================================
-- Rang 9 ROADMAP (dernier point des "petits trous fonctionnels avant
-- lancement") : un échec de renouvellement de l'abonnement plateforme
-- (beatmaker → My Producer, table abonnements_plateforme) n'était tracé
-- nulle part — traiterEchecRenouvellementAbonnement() ne cherchait que
-- côté abonnements_boutique. Même modèle que les migrations précédentes sur
-- cette table (réutilise tentatives_paiement plutôt qu'une nouvelle table),
-- un 4e type ajouté à la forme la plus récente (supabase/express_checkout.sql,
-- 2026-08-04 — pas tentatives_paiement_abonnement.sql/phase2b, dépassées
-- depuis par phase2c_panier.sql puis express_checkout.sql).

ALTER TABLE tentatives_paiement ADD COLUMN abonnement_plateforme_id uuid
  REFERENCES abonnements_plateforme(id) ON DELETE CASCADE;

ALTER TABLE tentatives_paiement DROP CONSTRAINT tentatives_paiement_type_check;
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_type_check
  CHECK (type IN ('achat_beat', 'achat_express', 'renouvellement_abonnement', 'renouvellement_abonnement_plateforme'));

ALTER TABLE tentatives_paiement DROP CONSTRAINT tentatives_paiement_forme_coherente;
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_forme_coherente CHECK (
  (type = 'achat_beat' AND stripe_session_id IS NOT NULL AND stripe_payment_intent_id IS NULL
    AND abonnement_id IS NULL AND stripe_invoice_id IS NULL AND abonnement_plateforme_id IS NULL)
  OR
  (type = 'achat_express' AND stripe_payment_intent_id IS NOT NULL AND stripe_session_id IS NULL
    AND abonnement_id IS NULL AND stripe_invoice_id IS NULL AND abonnement_plateforme_id IS NULL)
  OR
  (type = 'renouvellement_abonnement' AND abonnement_id IS NOT NULL AND stripe_invoice_id IS NOT NULL
    AND stripe_session_id IS NULL AND stripe_payment_intent_id IS NULL AND abonnement_plateforme_id IS NULL)
  OR
  (type = 'renouvellement_abonnement_plateforme' AND abonnement_plateforme_id IS NOT NULL AND stripe_invoice_id IS NOT NULL
    AND stripe_session_id IS NULL AND stripe_payment_intent_id IS NULL AND abonnement_id IS NULL)
);

CREATE INDEX ON tentatives_paiement (abonnement_plateforme_id);
