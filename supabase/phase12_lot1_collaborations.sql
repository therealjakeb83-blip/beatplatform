-- ============================================================
-- PHASE 12 — LOT 1 : fondations du modèle de collaboration
-- (chantier 9 bis — décisions : memory/project_phase12_grillme_decisions_2026_09_21.md)
--
-- À exécuter dans l'éditeur SQL Supabase, en UNE seule fois (une transaction :
-- si une ligne échoue, rien n'est appliqué). Vérifications en fin de fichier.
-- ============================================================

BEGIN;

-- Garde-fou : d'anciennes collaborations de test hors des nouvelles limites
-- (part hors 10-90 %, total > 90 %, plus de 3 collaborateurs) feraient échouer
-- la migration. On le dit clairement au lieu d'une erreur obscure.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM beat_splits WHERE pourcentage NOT BETWEEN 10 AND 90)
     OR EXISTS (SELECT 1 FROM beat_splits GROUP BY beat_id HAVING SUM(pourcentage) > 90 OR COUNT(*) > 3) THEN
    RAISE EXCEPTION 'Anciennes collaborations de test hors limites : exécute d''abord phase12_lot1_nettoyage_donnees_test_collab.sql (partie B), puis relance cette migration.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. beat_splits : nouveaux états (en français) + colonnes de preuve
-- ------------------------------------------------------------

-- Anciens statuts -> nouveaux (les vraies données sont fictives et seront
-- effacées par phase12_lot1_nettoyage_donnees_test_collab.sql, mais on ne
-- veut pas que la migration échoue si ce ménage n'a pas encore été fait).
ALTER TABLE beat_splits DROP CONSTRAINT IF EXISTS beat_splits_statut_check;
UPDATE beat_splits SET statut = 'active'  WHERE statut = 'actif';
UPDATE beat_splits SET statut = 'invitee' WHERE statut = 'en_attente';
UPDATE beat_splits SET statut = 'refusee' WHERE statut = 'refuse';

ALTER TABLE beat_splits
  ALTER COLUMN statut SET DEFAULT 'invitee',
  ADD CONSTRAINT beat_splits_statut_check
    CHECK (statut IN ('invitee', 'active', 'refusee', 'retiree', 'quittee', 'evincee'));

-- Preuve d'acceptation (version du texte + date + quote-part acceptée) et
-- horodatage de chaque fin de collaboration.
ALTER TABLE beat_splits
  ADD COLUMN IF NOT EXISTS conditions_version   integer,
  ADD COLUMN IF NOT EXISTS accepte_le           timestamptz,
  ADD COLUMN IF NOT EXISTS quote_part_acceptee  integer,
  ADD COLUMN IF NOT EXISTS refuse_le            timestamptz,
  ADD COLUMN IF NOT EXISTS retire_le            timestamptz,
  ADD COLUMN IF NOT EXISTS quitte_le            timestamptz,
  ADD COLUMN IF NOT EXISTS evince_le            timestamptz,
  ADD COLUMN IF NOT EXISTS motif_eviction       text;

-- Une collaboration ACTIVE a forcément une preuve d'acceptation.
-- NOT VALID : ne contrôle que les lignes écrites à partir de maintenant
-- (les éventuelles anciennes lignes de test seront effacées).
ALTER TABLE beat_splits
  ADD CONSTRAINT beat_splits_active_a_une_preuve
    CHECK (statut <> 'active' OR (accepte_le IS NOT NULL AND conditions_version IS NOT NULL AND quote_part_acceptee IS NOT NULL))
    NOT VALID;

-- ------------------------------------------------------------
-- 2. Part de chaque collaborateur : entre 10 % et 90 %
--    (chaque part >= 10 %, A doit garder au moins 10 %)
-- ------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'beat_splits'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%pourcentage%'
  LOOP
    EXECUTE format('ALTER TABLE beat_splits DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE beat_splits
  ADD CONSTRAINT beat_splits_pourcentage_check CHECK (pourcentage BETWEEN 10 AND 90);

-- ------------------------------------------------------------
-- 3. Unicité : un seul collaborateur NON TERMINÉ par beat
--    (après un départ / une éviction / un retrait, on peut ré-inviter)
-- ------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'beat_splits'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE beat_splits DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS beat_splits_un_compte_ouvert_par_beat
  ON beat_splits (beat_id, beatmaker_id)
  WHERE beatmaker_id IS NOT NULL AND statut IN ('invitee', 'active', 'refusee');

CREATE UNIQUE INDEX IF NOT EXISTS beat_splits_un_email_ouvert_par_beat
  ON beat_splits (beat_id, email_invite)
  WHERE email_invite IS NOT NULL AND statut IN ('invitee', 'active', 'refusee');

-- ------------------------------------------------------------
-- 4. Pas de renégociation : la part d'un collaborateur ne change jamais
--    (pour changer une répartition : quitter / retirer, puis ré-inviter)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION beat_splits_verrou_part() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pourcentage IS DISTINCT FROM OLD.pourcentage THEN
    RAISE EXCEPTION 'La part d''un collaborateur ne peut pas être modifiée : retire l''invitation puis invite à nouveau.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS beat_splits_verrou_part_trg ON beat_splits;
CREATE TRIGGER beat_splits_verrou_part_trg
  BEFORE UPDATE ON beat_splits
  FOR EACH ROW EXECUTE FUNCTION beat_splits_verrou_part();

-- ------------------------------------------------------------
-- 5. beats : quote-part explicite de A + drapeau « hors vente »
--    Les deux colonnes sont calculées PAR LA BASE (trigger ci-dessous) à chaque
--    changement d'une collaboration : impossible de les oublier côté code.
--      quote_part_proprietaire = 100 - somme des parts non terminées
--      hors_vente_collab       = au moins une collaboration non terminée
--    (tant que la Phase 13 n'ouvre pas les ventes collab, TOUT beat ayant une
--    collaboration ouverte — invitée, active ou refusée — reste hors vente)
-- ------------------------------------------------------------
ALTER TABLE beats
  ADD COLUMN IF NOT EXISTS quote_part_proprietaire integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS hors_vente_collab       boolean NOT NULL DEFAULT false;

ALTER TABLE beats DROP CONSTRAINT IF EXISTS beats_quote_part_proprietaire_check;
ALTER TABLE beats
  ADD CONSTRAINT beats_quote_part_proprietaire_check CHECK (quote_part_proprietaire BETWEEN 10 AND 100);

CREATE OR REPLACE FUNCTION recalculer_collaboration_beat(p_beat_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_somme integer;
  v_nb    integer;
BEGIN
  SELECT COALESCE(SUM(pourcentage), 0), COUNT(*) INTO v_somme, v_nb
  FROM beat_splits
  WHERE beat_id = p_beat_id AND statut IN ('invitee', 'active', 'refusee');

  IF v_nb > 3 THEN
    RAISE EXCEPTION 'Un beat accepte au maximum 3 collaborateurs (plus toi).' USING ERRCODE = 'P0001';
  END IF;

  UPDATE beats
     SET quote_part_proprietaire = 100 - v_somme,
         hors_vente_collab       = (v_nb > 0)
   WHERE id = p_beat_id;
END $$;

CREATE OR REPLACE FUNCTION beat_splits_recalcul_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculer_collaboration_beat(OLD.beat_id);
    RETURN OLD;
  END IF;
  PERFORM recalculer_collaboration_beat(NEW.beat_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS beat_splits_recalcul ON beat_splits;
CREATE TRIGGER beat_splits_recalcul
  AFTER INSERT OR UPDATE OR DELETE ON beat_splits
  FOR EACH ROW EXECUTE FUNCTION beat_splits_recalcul_trg();

-- Remise à niveau de tous les beats existants (ceux sans collaboration ouverte
-- repassent à 100 % / en vente).
UPDATE beats b
   SET quote_part_proprietaire = 100 - COALESCE((
         SELECT SUM(pourcentage) FROM beat_splits
         WHERE beat_id = b.id AND statut IN ('invitee', 'active', 'refusee')
       ), 0),
       hors_vente_collab = EXISTS (
         SELECT 1 FROM beat_splits
         WHERE beat_id = b.id AND statut IN ('invitee', 'active', 'refusee')
       );

-- ------------------------------------------------------------
-- 6. commande_tranches : une « tranche » par vendeur d'une commande
--    (créée vide au lot 1, alimentée en Phase 13 — une seule commande, celle de
--    A ; à l'intérieur, une tranche par vendeur avec sa part, sa TVA figée, sa
--    facture, son état de remboursement, ses frais Stripe)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commande_tranches (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  commande_id               uuid NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  vendeur_id                uuid REFERENCES beatmakers(id) ON DELETE SET NULL,
  vendeur_nom               text NOT NULL,
  beat_split_id             uuid REFERENCES beat_splits(id) ON DELETE SET NULL,
  est_proprietaire          boolean NOT NULL DEFAULT false,
  quote_part_pct            integer NOT NULL CHECK (quote_part_pct BETWEEN 10 AND 100),
  montant_ttc_cents         integer NOT NULL CHECK (montant_ttc_cents >= 0),
  tva_taux                  numeric,
  montant_tva_cents         integer,
  montant_ht_cents          integer,
  facture_numero            text,
  facture_pdf_url           text,
  stripe_account_id         text,
  stripe_payment_intent_id  text,
  frais_stripe_cents        integer,
  net_cents                 integer,
  montant_rembourse_cents   integer NOT NULL DEFAULT 0 CHECK (montant_rembourse_cents >= 0),
  statut                    text NOT NULL DEFAULT 'en_attente'
                              CHECK (statut IN ('en_attente', 'payee', 'remboursee_partielle', 'remboursee', 'annulee'))
);

CREATE INDEX IF NOT EXISTS commande_tranches_commande_idx ON commande_tranches (commande_id);
CREATE INDEX IF NOT EXISTS commande_tranches_vendeur_idx  ON commande_tranches (vendeur_id);

ALTER TABLE commande_tranches ENABLE ROW LEVEL SECURITY;

-- Un vendeur voit sa propre tranche ; le propriétaire de la commande (A) voit
-- toutes les tranches de ses commandes. Personne n'écrit via l'API publique :
-- seules les routes serveur (service_role) créent / modifient les tranches.
DROP POLICY IF EXISTS "vendeur voit sa tranche" ON commande_tranches;
CREATE POLICY "vendeur voit sa tranche"
  ON commande_tranches FOR SELECT TO authenticated
  USING (vendeur_id = auth.uid());

DROP POLICY IF EXISTS "proprietaire voit les tranches de ses commandes" ON commande_tranches;
CREATE POLICY "proprietaire voit les tranches de ses commandes"
  ON commande_tranches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM commandes c
    WHERE c.id = commande_tranches.commande_id AND c.beatmaker_id = auth.uid()
  ));

GRANT SELECT ON commande_tranches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON commande_tranches TO service_role;

-- ------------------------------------------------------------
-- 7. Journal des décisions : nouveau type d'entité « collaboration »
-- ------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'merchant_decisions_log'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%entity_type%'
  LOOP
    EXECUTE format('ALTER TABLE merchant_decisions_log DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE merchant_decisions_log
  ADD CONSTRAINT merchant_decisions_log_entity_type_check
    CHECK (entity_type IN ('commande', 'boutique', 'page_legale', 'licence_texte', 'collaboration'));

-- ------------------------------------------------------------
-- 8. Accès des collaborateurs à leurs collaborations (service_role déjà OK)
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON beat_splits TO authenticated;
GRANT ALL ON beat_splits TO service_role;
GRANT UPDATE ON beats TO service_role;

COMMIT;

-- ============================================================
-- VÉRIFICATIONS À LANCER APRÈS (lecture seule) — tout doit ressembler à :
-- ============================================================
-- select column_name from information_schema.columns
--  where table_name = 'beats' and column_name in ('quote_part_proprietaire', 'hors_vente_collab');   -- 2 lignes
-- select conname from pg_constraint where conrelid = 'beat_splits'::regclass;                     -- pas de contrainte "unique"
-- select tgname from pg_trigger where tgrelid = 'beat_splits'::regclass and not tgisinternal;      -- 2 triggers
-- select count(*) from commande_tranches;                                                          -- 0
