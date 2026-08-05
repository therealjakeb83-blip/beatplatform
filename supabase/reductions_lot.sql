-- ============================================================
-- Réductions par lot — "achète X, obtiens Y offert(s)"
-- ============================================================
-- Décisions actées avec Jake (session 2026-08-05) :
-- - Une règle cible UNE seule licence (pas de regroupement multi-licences).
-- - Une seule règle ACTIVE à la fois par licence (contrainte en base, pas
--   seulement côté UI) — index unique partiel ci-dessous.
-- - Article offert = le moins cher parmi les articles éligibles au panier ;
--   en cas d'égalité de prix, le dernier ajouté au panier. Calculé côté
--   lib/pricing.ts (jamais confiance dans le panier client), pas ici.
-- - Cumul avec un code promo : configurable PAR CODE PROMO (nouvelle colonne
--   codes_promo.cumulable_reduction_lot), pas une règle globale.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

-- ============================================================
-- 1. TABLE : reductions_lot
-- ============================================================

CREATE TABLE IF NOT EXISTS reductions_lot (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  licence_id    uuid        NOT NULL REFERENCES licences(id) ON DELETE CASCADE,
  nom           text        NOT NULL,
  nb_a_acheter  integer     NOT NULL CHECK (nb_a_acheter >= 1),
  nb_offerts    integer     NOT NULL CHECK (nb_offerts >= 1),
  actif         boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reductions_lot_beatmaker_idx ON reductions_lot (beatmaker_id);
CREATE INDEX IF NOT EXISTS reductions_lot_licence_idx ON reductions_lot (licence_id);

-- Une seule règle active par licence — imposé en base, pas seulement dans
-- la modale dashboard (défense en profondeur, cf. feedback_verifier_migrations_sql).
CREATE UNIQUE INDEX IF NOT EXISTS reductions_lot_licence_active_unique
  ON reductions_lot (beatmaker_id, licence_id) WHERE actif = true;

ALTER TABLE reductions_lot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reductions_lot_beatmaker_own" ON reductions_lot
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON reductions_lot TO authenticated;
GRANT ALL ON reductions_lot TO service_role;

-- ============================================================
-- 2. codes_promo : cumul configurable avec les réductions par lot
-- ============================================================

ALTER TABLE codes_promo ADD COLUMN IF NOT EXISTS cumulable_reduction_lot boolean NOT NULL DEFAULT true;

-- ============================================================
-- 3. Traçabilité : quelle ligne a été offerte via quelle règle
-- ============================================================

ALTER TABLE commande_lignes ADD COLUMN IF NOT EXISTS reduction_lot_id uuid REFERENCES reductions_lot(id) ON DELETE SET NULL;
ALTER TABLE tentatives_paiement_lignes ADD COLUMN IF NOT EXISTS reduction_lot_id uuid REFERENCES reductions_lot(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commande_lignes_reduction_lot_idx ON commande_lignes (reduction_lot_id) WHERE reduction_lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tentatives_paiement_lignes_reduction_lot_idx ON tentatives_paiement_lignes (reduction_lot_id) WHERE reduction_lot_id IS NOT NULL;
