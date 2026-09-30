-- Phase 13, lot 3 (après la vente) — 2026-09-30
-- 1. commande_tranches : facture de chaque vendeur figée sur sa tranche
--    (modèle, mentions, mandat, numéro de TVA), comme commandes le fait en solo.
-- 2. tentatives_paiement_parts : une part peut valoir 0 € (beat collab offert
--    dans un panier payant) — jamais encaissée, mais le vendeur garde sa tranche.
-- 3. tentatives_paiement : nouveau type « commande_gratuite » (aucun objet Stripe).
-- 4. commandes.methode_paiement : nouvelle valeur « gratuit ».
-- 5. templates_plateforme : nouvel email « nouvelle_vente » (Mails My Producer).
-- 6. Codes promo : prise de place atomique (compteur fiable).
-- Une seule transaction : tout passe ou rien ne change.

BEGIN;

-- 1. commande_tranches
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS facture_modele text;
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS facture_mentions text;
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS mandat_facturation_version integer;
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS tva_numero text;

-- 2. tentatives_paiement_parts : contrainte montant >= 50 (nommée automatiquement)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'tentatives_paiement_parts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%montant_cents%'
  LOOP
    EXECUTE format('ALTER TABLE tentatives_paiement_parts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE tentatives_paiement_parts ADD CONSTRAINT tentatives_paiement_parts_montant_check
  CHECK (montant_cents = 0 OR montant_cents >= 50);

-- 3. tentatives_paiement
ALTER TABLE tentatives_paiement DROP CONSTRAINT IF EXISTS tentatives_paiement_type_check;
ALTER TABLE tentatives_paiement ADD CONSTRAINT tentatives_paiement_type_check
  CHECK (type IN ('achat_beat', 'achat_express', 'achat_multi', 'commande_gratuite', 'renouvellement_abonnement', 'renouvellement_abonnement_plateforme'));

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
  (type = 'commande_gratuite' AND stripe_session_id IS NULL AND stripe_payment_intent_id IS NULL
    AND stripe_setup_intent_id IS NULL AND abonnement_id IS NULL AND stripe_invoice_id IS NULL
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

-- 4. commandes.methode_paiement (contrainte d'origine nommée automatiquement)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'commandes'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%methode_paiement%'
  LOOP
    EXECUTE format('ALTER TABLE commandes DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE commandes ADD CONSTRAINT commandes_methode_paiement_check
  CHECK (methode_paiement IN ('stripe', 'paypal', 'apple_pay', 'google_pay', 'gratuit'));

-- 5. templates_plateforme
ALTER TABLE templates_plateforme DROP CONSTRAINT IF EXISTS templates_plateforme_type_check;
ALTER TABLE templates_plateforme ADD CONSTRAINT templates_plateforme_type_check CHECK (type IN (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'suspension',
  'collab_invitation', 'collab_acceptation', 'collab_refus', 'collab_retrait',
  'collab_depart', 'collab_eviction', 'collab_beat_supprime', 'collab_pause',
  'conditions_mise_a_jour',
  'nouvelle_vente'
));

-- 6. Codes promo : « s'il reste une place, je la prends » en une seule
--    opération (deux validations simultanées ne peuvent pas prendre la même).
--    p_forcer = true : vente déjà payée, on compte toujours (jamais de refus
--    après encaissement).
CREATE OR REPLACE FUNCTION code_promo_prendre_place(p_code_id uuid, p_forcer boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE codes_promo
     SET utilisations = utilisations + 1
   WHERE id = p_code_id
     AND (p_forcer OR limite_par_code IS NULL OR utilisations < limite_par_code);
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION code_promo_rendre_place(p_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE codes_promo SET utilisations = GREATEST(utilisations - 1, 0) WHERE id = p_code_id;
$$;

REVOKE ALL ON FUNCTION code_promo_prendre_place(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION code_promo_rendre_place(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION code_promo_prendre_place(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION code_promo_rendre_place(uuid) TO service_role;

COMMIT;

-- ------------------------------------------------------------
-- Vérifications (à lancer après, résultats attendus en commentaire)
-- ------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'commande_tranches'
--     and column_name in ('facture_modele', 'facture_mentions', 'mandat_facturation_version', 'tva_numero');  -- 4 lignes
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'tentatives_paiement_parts'::regclass and contype = 'c';                                 -- montant_cents = 0 OR >= 50 (+ statut)
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'tentatives_paiement_type_check';       -- contient commande_gratuite
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'commandes'::regclass and pg_get_constraintdef(oid) ilike '%methode_paiement%';           -- 1 seule ligne, contient gratuit
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'templates_plateforme_type_check';     -- contient nouvelle_vente
-- select routine_name from information_schema.routines
--   where routine_name in ('code_promo_prendre_place', 'code_promo_rendre_place');                          -- 2 lignes
