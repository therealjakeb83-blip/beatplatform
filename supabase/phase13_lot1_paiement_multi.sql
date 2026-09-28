-- ============================================================
-- Phase 13, lot 1 — paiement réparti entre vendeurs (multi-Direct-Charge)
-- ============================================================
-- Un panier contenant au moins un beat collab est payé en plusieurs
-- encaissements (un par vendeur), sans jamais faire transiter l'argent par la
-- plateforme : SetupIntent sur la plateforme (aucun argent), copie de la
-- carte vers chaque compte vendeur, réservation de chaque part, puis capture
-- de toutes les parts (ou annulation de toutes).
--
-- 1. tentatives_paiement : nouveau type 'achat_multi', suivi par SetupIntent,
--    + statut 'en_cours' (verrou : une seule finalisation à la fois).
-- 2. tentatives_paiement_parts : une ligne par vendeur et par tentative.
-- 3. commande_tranches : part non obligatoire (tranche mixte solo + collab)
--    + détail par ligne.
-- 4. commandes.paiement_multi_vendeurs.
-- Une seule transaction : tout passe ou rien ne change.

BEGIN;

-- 1. tentatives_paiement
ALTER TABLE tentatives_paiement ADD COLUMN IF NOT EXISTS stripe_setup_intent_id text UNIQUE;
ALTER TABLE tentatives_paiement ADD COLUMN IF NOT EXISTS metadonnees jsonb;

ALTER TABLE tentatives_paiement DROP CONSTRAINT IF EXISTS tentatives_paiement_type_check;
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_type_check
  CHECK (type IN ('achat_beat', 'achat_express', 'achat_multi', 'renouvellement_abonnement', 'renouvellement_abonnement_plateforme'));

ALTER TABLE tentatives_paiement DROP CONSTRAINT IF EXISTS tentatives_paiement_forme_coherente;
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_forme_coherente CHECK (
  (type = 'achat_beat' AND stripe_session_id IS NOT NULL AND stripe_payment_intent_id IS NULL
    AND abonnement_id IS NULL AND stripe_invoice_id IS NULL AND abonnement_plateforme_id IS NULL
    AND stripe_setup_intent_id IS NULL)
  OR
  (type = 'achat_express' AND stripe_payment_intent_id IS NOT NULL AND stripe_session_id IS NULL
    AND abonnement_id IS NULL AND stripe_invoice_id IS NULL AND abonnement_plateforme_id IS NULL
    AND stripe_setup_intent_id IS NULL)
  OR
  (type = 'achat_multi' AND stripe_setup_intent_id IS NOT NULL AND stripe_payment_intent_id IS NULL
    AND stripe_session_id IS NULL AND abonnement_id IS NULL AND stripe_invoice_id IS NULL
    AND abonnement_plateforme_id IS NULL)
  OR
  (type = 'renouvellement_abonnement' AND abonnement_id IS NOT NULL AND stripe_invoice_id IS NOT NULL
    AND stripe_session_id IS NULL AND stripe_payment_intent_id IS NULL AND abonnement_plateforme_id IS NULL
    AND stripe_setup_intent_id IS NULL)
  OR
  (type = 'renouvellement_abonnement_plateforme' AND abonnement_plateforme_id IS NOT NULL AND stripe_invoice_id IS NOT NULL
    AND stripe_session_id IS NULL AND stripe_payment_intent_id IS NULL AND abonnement_id IS NULL
    AND stripe_setup_intent_id IS NULL)
);

ALTER TABLE tentatives_paiement DROP CONSTRAINT IF EXISTS tentatives_paiement_statut_check;
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_statut_check
  CHECK (statut IN ('creee', 'en_cours', 'complete', 'expiree', 'echouee'));

-- 2. tentatives_paiement_parts
CREATE TABLE IF NOT EXISTS tentatives_paiement_parts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  tentative_id                uuid NOT NULL REFERENCES tentatives_paiement(id) ON DELETE CASCADE,
  vendeur_id                  uuid NOT NULL REFERENCES beatmakers(id),
  est_proprietaire            boolean NOT NULL DEFAULT false,
  stripe_account_id           text NOT NULL,
  montant_cents               integer NOT NULL CHECK (montant_cents >= 50),
  -- [{ beat_id, licence_id, prix_ligne_cents, pourcentage, montant_cents }]
  detail_lignes               jsonb NOT NULL,
  stripe_payment_intent_id    text UNIQUE,
  statut                      text NOT NULL DEFAULT 'a_reserver'
                                CHECK (statut IN ('a_reserver', 'reservee', 'capturee', 'annulee', 'echouee', 'remboursee')),
  erreur                      text,
  UNIQUE (tentative_id, vendeur_id)
);

CREATE INDEX IF NOT EXISTS tentatives_paiement_parts_tentative_idx ON tentatives_paiement_parts (tentative_id);

ALTER TABLE tentatives_paiement_parts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tentatives_paiement_parts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON tentatives_paiement_parts TO service_role;

-- 3. commande_tranches
ALTER TABLE commande_tranches ALTER COLUMN quote_part_pct DROP NOT NULL;
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS detail_lignes jsonb;

-- 4. commandes
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS paiement_multi_vendeurs boolean NOT NULL DEFAULT false;

COMMIT;

-- ------------------------------------------------------------
-- Vérifications (à lancer après, résultats attendus en commentaire)
-- ------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'tentatives_paiement' and column_name in ('stripe_setup_intent_id', 'metadonnees');   -- 2 lignes
-- select count(*) from tentatives_paiement_parts;                                                           -- 0
-- select is_nullable from information_schema.columns
--   where table_name = 'commande_tranches' and column_name = 'quote_part_pct';                               -- YES
-- select count(*) from commandes where paiement_multi_vendeurs;                                             -- 0
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'tentatives_paiement_parts' order by 1, 2;                                           -- service_role seulement
