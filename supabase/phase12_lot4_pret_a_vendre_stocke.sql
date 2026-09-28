-- ============================================================
-- PHASE 12 — LOT 4 (complément, décision de Jake du 2026-09-28 en testant T2)
-- « Prêt à vendre » enregistré sur chaque beatmaker, pour qu'un beat collab
-- sorte de la boutique dès qu'un de ses vendeurs n'est plus éligible aux
-- paiements (et y revienne une fois réglé).
--   pret_a_vendre_concedant     = critères complets (A : + livraison, CGV, mentions)
--   pret_a_vendre_collaborateur = critères de B
-- Recalculés par le code (lib/pret-a-vendre-suivi.ts) à chaque réglage qui
-- compte et à chaque changement signalé par Stripe ; les comptes de test et
-- l'admin sont toujours « prêts ».
-- À exécuter dans l'éditeur SQL Supabase, en UNE seule fois (une transaction).
-- ============================================================

BEGIN;

ALTER TABLE beatmakers
  ADD COLUMN IF NOT EXISTS pret_a_vendre_concedant     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pret_a_vendre_collaborateur boolean NOT NULL DEFAULT false;

-- Comptes exemptés : prêts d'office. Les autres seront calculés par le code
-- (bouton admin « recalculer », voir T0 du complément).
UPDATE beatmakers
   SET pret_a_vendre_concedant = true, pret_a_vendre_collaborateur = true
 WHERE role = 'admin' OR abonnement_exempte;

-- hors vente = invitation/refus ouvert
--            OU (collaborateur actif ET (interrupteur OFF OU un vendeur pas prêt))
CREATE OR REPLACE FUNCTION recalculer_collaboration_beat(p_beat_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_somme              integer;
  v_nb                 integer;
  v_nb_attente         integer;
  v_nb_actives         integer;
  v_interrupteur       boolean;
  v_vendeur_pas_pret   boolean;
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

  SELECT
    EXISTS (SELECT 1 FROM beats b JOIN beatmakers bm ON bm.id = b.beatmaker_id
             WHERE b.id = p_beat_id AND NOT bm.pret_a_vendre_concedant)
    OR EXISTS (SELECT 1 FROM beat_splits s LEFT JOIN beatmakers bm ON bm.id = s.beatmaker_id
                WHERE s.beat_id = p_beat_id AND s.statut = 'active'
                  AND NOT COALESCE(bm.pret_a_vendre_collaborateur, false))
    INTO v_vendeur_pas_pret;

  UPDATE beats
     SET quote_part_proprietaire = 100 - v_somme,
         hors_vente_collab       = (v_nb_attente > 0)
                                   OR (v_nb_actives > 0 AND (NOT v_interrupteur OR v_vendeur_pas_pret))
   WHERE id = p_beat_id;
END $$;

-- Un vendeur qui gagne ou perd son statut « prêt » recalcule les beats où il
-- vend (comme propriétaire ou comme collaborateur actif).
CREATE OR REPLACE FUNCTION beatmakers_pret_a_vendre_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT s.beat_id FROM beat_splits s JOIN beats b ON b.id = s.beat_id
     WHERE b.beatmaker_id = NEW.id
    UNION
    SELECT DISTINCT s.beat_id FROM beat_splits s
     WHERE s.beatmaker_id = NEW.id AND s.statut = 'active'
  LOOP
    PERFORM recalculer_collaboration_beat(r.beat_id);
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS beatmakers_pret_a_vendre ON beatmakers;
CREATE TRIGGER beatmakers_pret_a_vendre
  AFTER UPDATE OF pret_a_vendre_concedant, pret_a_vendre_collaborateur ON beatmakers
  FOR EACH ROW
  WHEN (OLD.pret_a_vendre_concedant IS DISTINCT FROM NEW.pret_a_vendre_concedant
     OR OLD.pret_a_vendre_collaborateur IS DISTINCT FROM NEW.pret_a_vendre_collaborateur)
  EXECUTE FUNCTION beatmakers_pret_a_vendre_trg();

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
-- select slug, pret_a_vendre_concedant, pret_a_vendre_collaborateur
--   from beatmakers where role = 'admin' or abonnement_exempte;
--   -- tous à true
-- select tgname from pg_trigger where tgname = 'beatmakers_pret_a_vendre';
--   -- 1 ligne
