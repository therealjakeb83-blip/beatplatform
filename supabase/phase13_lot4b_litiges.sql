-- Phase 13, lot 4b (litiges) — 2026-10-01
-- 1. litiges : un litige Stripe = une part (solo : la commande entière ;
--    collab : la part d'un vendeur, sur SON compte). beatmaker_id = le vendeur
--    dont le compte porte le litige (montant = sa part). Suivi de la réponse
--    (qui a répondu, quand), date limite, alerte et rappel envoyés.
-- 2. templates_plateforme : emails « litige ouvert » (A), « rappel litige »
--    (A, 3 jours avant la limite), « litige sur une vente en collaboration » (B).
-- Une seule transaction : tout passe ou rien ne change.

BEGIN;

-- 1. litiges
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS tranche_id uuid REFERENCES commande_tranches(id) ON DELETE SET NULL;
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS motif text;
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS date_limite timestamptz;
-- 'proprietaire' = envoyée par A depuis la fiche commande ; 'vendeur_stripe' =
-- le vendeur a répondu lui-même depuis son espace Stripe (plus de réponse
-- possible pour cette part) ; 'acceptation' = A a accepté le litige (perdu).
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS reponse_par text;
ALTER TABLE litiges DROP CONSTRAINT IF EXISTS litiges_reponse_par_check;
ALTER TABLE litiges ADD CONSTRAINT litiges_reponse_par_check
  CHECK (reponse_par IS NULL OR reponse_par IN ('proprietaire', 'vendeur_stripe', 'acceptation'));
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS reponse_envoyee_at timestamptz;
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS reponse_texte text;
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS reponse_fichier_nom text;
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS reponse_erreur text;
-- Emails : un seul « litige ouvert » à A même pour plusieurs parts, un seul rappel.
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS alerte_envoyee_at timestamptz;
ALTER TABLE litiges ADD COLUMN IF NOT EXISTS rappel_envoye_at timestamptz;

CREATE INDEX IF NOT EXISTS litiges_tranche_idx ON litiges (tranche_id);

-- Le propriétaire de la boutique voit aussi les litiges des parts de ses
-- collaborateurs (il gère le litige de toute la vente).
DROP POLICY IF EXISTS "proprietaire voit les litiges de ses commandes" ON litiges;
CREATE POLICY "proprietaire voit les litiges de ses commandes"
  ON litiges FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM commandes c
    WHERE c.id = litiges.commande_id AND c.beatmaker_id = auth.uid()
  ));

-- 2. templates_plateforme
ALTER TABLE templates_plateforme DROP CONSTRAINT IF EXISTS templates_plateforme_type_check;
ALTER TABLE templates_plateforme ADD CONSTRAINT templates_plateforme_type_check CHECK (type IN (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'suspension',
  'collab_invitation', 'collab_acceptation', 'collab_refus', 'collab_retrait',
  'collab_depart', 'collab_eviction', 'collab_beat_supprime', 'collab_pause',
  'conditions_mise_a_jour',
  'nouvelle_vente',
  'remboursement_vente', 'remboursement_incomplet',
  'litige_ouvert', 'litige_rappel', 'litige_collaborateur'
));

COMMIT;

-- ------------------------------------------------------------
-- Vérifications (à lancer après, résultats attendus en commentaire)
-- ------------------------------------------------------------
-- select column_name from information_schema.columns where table_name = 'litiges'
--   and column_name in ('tranche_id', 'stripe_account_id', 'motif', 'date_limite', 'reponse_par', 'reponse_envoyee_at',
--                       'reponse_texte', 'reponse_fichier_nom', 'reponse_erreur', 'alerte_envoyee_at', 'rappel_envoye_at');  -- 11 lignes
-- select policyname from pg_policies where tablename = 'litiges';  -- 2 lignes (beatmaker voit ses litiges + proprietaire voit…)
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'templates_plateforme_type_check';  -- contient litige_ouvert, litige_rappel, litige_collaborateur
