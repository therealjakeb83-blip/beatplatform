-- ============================================================
-- PHASE 12 — LOT 3 : un refus ferme la collaboration tout seul
-- Retour de Jake pendant le test T7 (2026-09-28) : jusqu'ici 'refusee'
-- comptait comme un état "ouvert" (comme 'invitee'/'active'), donc le beat
-- restait hors vente tant que A n'avait pas cliqué "Retirer l'invitation" à
-- la main — et cette action envoyait un email "invitation retirée" à B, qui
-- n'avait pourtant aucune raison d'en recevoir un puisque c'est lui qui avait
-- refusé. Un refus doit maintenant libérer le beat immédiatement, sans étape
-- manuelle ni second email.
--
-- À exécuter dans l'éditeur SQL Supabase, en UNE seule fois (une transaction).
-- Vérifications en fin de fichier.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Trigger de recalcul : ne compte plus 'refusee' comme ouvert
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculer_collaboration_beat(p_beat_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_somme integer;
  v_nb    integer;
BEGIN
  SELECT COALESCE(SUM(pourcentage), 0), COUNT(*) INTO v_somme, v_nb
  FROM beat_splits
  WHERE beat_id = p_beat_id AND statut IN ('invitee', 'active');

  IF v_nb > 3 THEN
    RAISE EXCEPTION 'Un beat accepte au maximum 3 collaborateurs (plus toi).' USING ERRCODE = 'P0001';
  END IF;

  UPDATE beats
     SET quote_part_proprietaire = 100 - v_somme,
         hors_vente_collab       = (v_nb > 0)
   WHERE id = p_beat_id;
END $$;

-- ------------------------------------------------------------
-- 2. Index d'unicité : un refus ne bloque plus une ré-invitation future
--    (le même beatmaker/email redevient immédiatement invitable)
-- ------------------------------------------------------------
DROP INDEX IF EXISTS beat_splits_un_compte_ouvert_par_beat;
CREATE UNIQUE INDEX beat_splits_un_compte_ouvert_par_beat
  ON beat_splits (beat_id, beatmaker_id)
  WHERE beatmaker_id IS NOT NULL AND statut IN ('invitee', 'active');

DROP INDEX IF EXISTS beat_splits_un_email_ouvert_par_beat;
CREATE UNIQUE INDEX beat_splits_un_email_ouvert_par_beat
  ON beat_splits (beat_id, email_invite)
  WHERE email_invite IS NOT NULL AND statut IN ('invitee', 'active');

-- ------------------------------------------------------------
-- 3. Recalcule immédiatement tout beat actuellement coincé par un refus
--    (débloque le beat de test de Jake sans qu'il ait à retoucher à rien)
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT beat_id FROM beat_splits WHERE statut = 'refusee' LOOP
    PERFORM recalculer_collaboration_beat(r.beat_id);
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- VÉRIFICATIONS À LANCER APRÈS (lecture seule) :
-- ============================================================
-- select hors_vente_collab, quote_part_proprietaire from beats
--  where id in (select beat_id from beat_splits where statut = 'refusee');
--  -- doit valoir false / 100 si le refus est la seule collaboration du beat
-- select indexdef from pg_indexes where tablename = 'beat_splits'
--  and indexname in ('beat_splits_un_compte_ouvert_par_beat', 'beat_splits_un_email_ouvert_par_beat');
--  -- les deux définitions ne doivent plus contenir 'refusee'
