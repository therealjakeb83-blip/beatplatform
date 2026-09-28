-- ============================================================
-- PHASE 12 — LOT 4 : feu vert, contrat, emails, Stripe
-- À exécuter dans l'éditeur SQL Supabase, en UNE seule fois (une transaction).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Emails « Mails My Producer » : les 5 emails de collaboration du lot 3
--    (jusque-là en texte brut) + 3 nouveaux (beat supprimé, pause, mise à
--    jour des conditions). Retire les 3 types devenus inutiles depuis le
--    ménage du lot 1 (fonds en attente / rappel / expiration) — leurs
--    éventuelles lignes de personnalisation sont supprimées d'abord.
-- ------------------------------------------------------------
DELETE FROM templates_plateforme
 WHERE type IN ('collab_fonds_attente', 'collab_rappel_fonds', 'collab_expiration');

ALTER TABLE templates_plateforme DROP CONSTRAINT IF EXISTS templates_plateforme_type_check;
ALTER TABLE templates_plateforme ADD CONSTRAINT templates_plateforme_type_check CHECK (type IN (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'suspension',
  'collab_invitation', 'collab_acceptation', 'collab_refus', 'collab_retrait',
  'collab_depart', 'collab_eviction', 'collab_beat_supprime', 'collab_pause',
  'conditions_mise_a_jour'
));

-- ------------------------------------------------------------
-- 2. Interrupteur global « ventes collab » — reste OFF jusqu'à la Phase 13
--    (paiement réparti entre vendeurs). Une seule ligne, sans bouton dans
--    l'admin : il ne se bascule qu'en SQL, volontairement.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parametres_plateforme (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  ventes_collab_actives  boolean NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now()
);
INSERT INTO parametres_plateforme (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE parametres_plateforme ENABLE ROW LEVEL SECURITY;
-- Lecture seule côté serveur (client admin) ; aucune policy : ni anon ni
-- authenticated n'y ont accès. Supabase leur donne des droits par défaut sur
-- toute nouvelle table : retirés explicitement (constaté en vérifiant T0).
GRANT SELECT, UPDATE ON parametres_plateforme TO service_role;
REVOKE ALL ON parametres_plateforme FROM anon, authenticated;

-- ------------------------------------------------------------
-- 3. Nouveau calcul de beats.hors_vente_collab (feu vert, partie « accords »)
--      hors vente = une invitation encore en attente ou refusée
--                   OU (au moins un collaborateur actif ET interrupteur OFF)
--    La partie « tous les vendeurs sont prêts à vendre » (Stripe, TVA,
--    mandats…) est vérifiée côté serveur au paiement (lib/feu-vert-collab.ts),
--    jamais ici : elle dépend de l'état réel des comptes Stripe.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculer_collaboration_beat(p_beat_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_somme        integer;
  v_nb           integer;
  v_nb_attente   integer;
  v_nb_actives   integer;
  v_interrupteur boolean;
BEGIN
  SELECT COALESCE(SUM(pourcentage), 0),
         COUNT(*),
         COUNT(*) FILTER (WHERE statut IN ('invitee', 'refusee')),
         COUNT(*) FILTER (WHERE statut = 'active')
    INTO v_somme, v_nb, v_nb_attente, v_nb_actives
  FROM beat_splits
  WHERE beat_id = p_beat_id AND statut IN ('invitee', 'active', 'refusee');

  IF v_nb > 3 THEN
    RAISE EXCEPTION 'Un beat accepte au maximum 3 collaborateurs (plus toi).' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE((SELECT ventes_collab_actives FROM parametres_plateforme WHERE id), false)
    INTO v_interrupteur;

  UPDATE beats
     SET quote_part_proprietaire = 100 - v_somme,
         hors_vente_collab       = (v_nb_attente > 0) OR (v_nb_actives > 0 AND NOT v_interrupteur)
   WHERE id = p_beat_id;
END $$;

-- Basculer l'interrupteur recalcule tous les beats concernés.
CREATE OR REPLACE FUNCTION parametres_plateforme_recalcul_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.ventes_collab_actives IS DISTINCT FROM OLD.ventes_collab_actives THEN
    FOR r IN SELECT DISTINCT beat_id FROM beat_splits LOOP
      PERFORM recalculer_collaboration_beat(r.beat_id);
    END LOOP;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS parametres_plateforme_recalcul ON parametres_plateforme;
CREATE TRIGGER parametres_plateforme_recalcul
  BEFORE UPDATE ON parametres_plateforme
  FOR EACH ROW EXECUTE FUNCTION parametres_plateforme_recalcul_trg();

-- Remise à niveau (ne change rien tant que l'interrupteur est OFF).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT beat_id FROM beat_splits LOOP
    PERFORM recalculer_collaboration_beat(r.beat_id);
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- VÉRIFICATIONS À LANCER APRÈS (lecture seule) :
-- ============================================================
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'templates_plateforme_type_check';
--  -- doit lister les 16 types, dont collab_pause et conditions_mise_a_jour
-- select * from parametres_plateforme;
--  -- 1 ligne, ventes_collab_actives = false
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'parametres_plateforme';
--  -- service_role : SELECT et UPDATE, rien pour anon/authenticated
-- select b.titre, b.hors_vente_collab from beats b
--  where exists (select 1 from beat_splits s where s.beat_id = b.id and s.statut = 'active');
--  -- tous à true tant que l'interrupteur est OFF
