-- Phase 13, lot 4a (remboursements, avoirs, annulation) — 2026-09-30
-- 1. commandes : nouveaux statuts (annulée, remboursement incomplet,
--    remboursée en partie) + licence annulée (ferme l'accès aux fichiers) +
--    suivi du remboursement d'une vente solo.
-- 2. commande_tranches : suivi du remboursement de chaque part.
-- 3. avoirs : une facture d'avoir par remboursement d'un vendeur qui avait
--    une facture (solo ou collab), numéro pris dans la suite de ses factures.
-- 4. templates_transactionnels : emails client « remboursement » et
--    « annulation » de commande.
-- 5. templates_plateforme : emails « remboursement d'une vente » et
--    « remboursement incomplet » (Mails My Producer).
-- Une seule transaction : tout passe ou rien ne change.

BEGIN;

-- 1. commandes
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'commandes'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%statut%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%statut_livraison%'
  LOOP
    EXECUTE format('ALTER TABLE commandes DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE commandes ADD CONSTRAINT commandes_statut_check
  CHECK (statut IN ('en_attente', 'payee', 'remboursee', 'litige', 'annulee', 'remboursement_incomplet', 'remboursee_partielle'));

-- Licence tombée (remboursement, annulation, litige perdu, part rendue par
-- un vendeur depuis Stripe) : l'accès aux fichiers est fermé dès que c'est
-- rempli. Jamais vidé ensuite.
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS licence_annulee_at timestamptz;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS licence_annulee_motif text;
ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_licence_annulee_motif_check;
ALTER TABLE commandes ADD CONSTRAINT commandes_licence_annulee_motif_check
  CHECK (licence_annulee_motif IS NULL OR licence_annulee_motif IN ('remboursement', 'annulation', 'remboursement_vendeur', 'litige_perdu'));

-- Vente solo : remboursement en montant (cents) + remboursement Stripe.
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS montant_rembourse_cents integer NOT NULL DEFAULT 0;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS stripe_refund_id text;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS rembourse_at timestamptz;
-- Verrou court pendant un remboursement (double clic, deux onglets) : un
-- seul remboursement à la fois par commande.
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS remboursement_verrou_at timestamptz;

-- 2. commande_tranches
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'commande_tranches'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%statut%'
  LOOP
    EXECUTE format('ALTER TABLE commande_tranches DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE commande_tranches ADD CONSTRAINT commande_tranches_statut_check
  CHECK (statut IN ('en_attente', 'payee', 'remboursee_partielle', 'remboursee', 'annulee', 'remboursement_echoue'));

ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS stripe_refund_id text;
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS remboursement_erreur text;
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS rembourse_at timestamptz;
-- 'proprietaire' = bouton de A ; 'vendeur_stripe' = remboursé par le vendeur
-- lui-même depuis son espace Stripe ; 'litige' = litige perdu (lot 4b).
ALTER TABLE commande_tranches ADD COLUMN IF NOT EXISTS rembourse_par text
  CHECK (rembourse_par IS NULL OR rembourse_par IN ('proprietaire', 'vendeur_stripe', 'litige'));

-- 3. avoirs
CREATE TABLE IF NOT EXISTS avoirs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  commande_id             uuid NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  tranche_id              uuid REFERENCES commande_tranches(id) ON DELETE SET NULL,
  vendeur_id              uuid REFERENCES beatmakers(id) ON DELETE SET NULL,
  numero                  text NOT NULL,
  facture_numero_annulee  text NOT NULL,
  facture_date            timestamptz NOT NULL,
  montant_cents           integer NOT NULL CHECK (montant_cents > 0),
  -- true = annule toute la facture (mêmes lignes) ; false = remboursement
  -- d'une partie seulement (une ligne « remboursement partiel »).
  total                   boolean NOT NULL,
  motif                   text NOT NULL CHECK (motif IN ('remboursement', 'remboursement_vendeur', 'litige_perdu')),
  pdf_url                 text,
  -- Idempotence : un remboursement / un litige Stripe ne donne jamais deux avoirs.
  source_stripe_id        text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS avoirs_commande_idx ON avoirs (commande_id);
CREATE INDEX IF NOT EXISTS avoirs_vendeur_idx ON avoirs (vendeur_id);
CREATE UNIQUE INDEX IF NOT EXISTS avoirs_numero_vendeur_uniq ON avoirs (vendeur_id, numero);

ALTER TABLE avoirs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendeur voit ses avoirs" ON avoirs;
CREATE POLICY "vendeur voit ses avoirs"
  ON avoirs FOR SELECT TO authenticated
  USING (vendeur_id = auth.uid());

DROP POLICY IF EXISTS "proprietaire voit les avoirs de ses commandes" ON avoirs;
CREATE POLICY "proprietaire voit les avoirs de ses commandes"
  ON avoirs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM commandes c
    WHERE c.id = avoirs.commande_id AND c.beatmaker_id = auth.uid()
  ));

GRANT SELECT ON avoirs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON avoirs TO service_role;

-- 4. templates_transactionnels
ALTER TABLE templates_transactionnels DROP CONSTRAINT IF EXISTS templates_transactionnels_type_check;
ALTER TABLE templates_transactionnels ADD CONSTRAINT templates_transactionnels_type_check
  CHECK (type IN (
    'confirmation_commande',
    'confirmation_abonnement',
    'demande_annulation_abonnement',
    'annulation_abonnement',
    'confirmation_compte_artiste',
    'telechargement_gratuit',
    'beat_cadeau_fidelite',
    'remboursement_commande',
    'annulation_commande'
  ));

-- 5. templates_plateforme
ALTER TABLE templates_plateforme DROP CONSTRAINT IF EXISTS templates_plateforme_type_check;
ALTER TABLE templates_plateforme ADD CONSTRAINT templates_plateforme_type_check CHECK (type IN (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'suspension',
  'collab_invitation', 'collab_acceptation', 'collab_refus', 'collab_retrait',
  'collab_depart', 'collab_eviction', 'collab_beat_supprime', 'collab_pause',
  'conditions_mise_a_jour',
  'nouvelle_vente',
  'remboursement_vente', 'remboursement_incomplet'
));

COMMIT;

-- ------------------------------------------------------------
-- Vérifications (à lancer après, résultats attendus en commentaire)
-- ------------------------------------------------------------
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'commandes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%statut%';  -- statut (avec annulee…) + statut_livraison + motif
-- select column_name from information_schema.columns where table_name = 'commandes'
--   and column_name in ('licence_annulee_at', 'licence_annulee_motif', 'montant_rembourse_cents', 'stripe_refund_id', 'rembourse_at', 'remboursement_verrou_at');  -- 6 lignes
-- select column_name from information_schema.columns where table_name = 'commande_tranches'
--   and column_name in ('stripe_refund_id', 'remboursement_erreur', 'rembourse_at', 'rembourse_par');  -- 4 lignes
-- select count(*) from avoirs;                                                                                   -- 0
-- select grantee, privilege_type from information_schema.role_table_grants where table_name = 'avoirs' order by 1, 2;  -- authenticated SELECT ; service_role INSERT/SELECT/UPDATE
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'templates_transactionnels_type_check';  -- contient remboursement_commande, annulation_commande
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'templates_plateforme_type_check';       -- contient remboursement_vente, remboursement_incomplet
