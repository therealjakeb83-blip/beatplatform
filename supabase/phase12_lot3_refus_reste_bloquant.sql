-- ============================================================
-- PHASE 12 — LOT 3 : annule phase12_lot3_refus_ferme_collab.sql
-- Retour de Jake (2026-09-28) sur une première tentative trop automatique :
-- un refus ne doit PAS remettre le beat en vente tout seul. A garde la main
-- pour décider quand repasser le beat en solo (bouton "Retirer l'invitation",
-- toujours disponible sur une collaboration refusée). Le seul vrai correctif
-- attendu était de ne plus envoyer à B un second email quand A retire une
-- invitation déjà refusée — corrigé côté code uniquement (aucun impact SQL),
-- voir app/api/business/collabs/[id]/retirer/route.ts.
--
-- Remet 'refusee' dans les états "ouverts" : trigger de recalcul + les 2
-- index d'unicité, comme au lot 1 (phase12_lot1_collaborations.sql).
--
-- À exécuter dans l'éditeur SQL Supabase, en UNE seule fois (une transaction).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Trigger de recalcul : redevient invitee/active/refusee (comme au lot 1)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2. Index d'unicité : un refus rebloque une ré-invitation tant qu'il n'est
--    pas retiré explicitement par A (comme au lot 1)
-- ------------------------------------------------------------
DROP INDEX IF EXISTS beat_splits_un_compte_ouvert_par_beat;
CREATE UNIQUE INDEX beat_splits_un_compte_ouvert_par_beat
  ON beat_splits (beat_id, beatmaker_id)
  WHERE beatmaker_id IS NOT NULL AND statut IN ('invitee', 'active', 'refusee');

DROP INDEX IF EXISTS beat_splits_un_email_ouvert_par_beat;
CREATE UNIQUE INDEX beat_splits_un_email_ouvert_par_beat
  ON beat_splits (beat_id, email_invite)
  WHERE email_invite IS NOT NULL AND statut IN ('invitee', 'active', 'refusee');

-- ------------------------------------------------------------
-- 3. Recalcule tout beat ayant une collaboration refusee : redevient
--    hors_vente_collab=true / quote_part réduite comme avant la migration
--    précédente (annule le déblocage fait par erreur).
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
--  -- doit valoir true / < 100 si le refus est encore présent (pas retiré)
-- select indexdef from pg_indexes where tablename = 'beat_splits'
--  and indexname in ('beat_splits_un_compte_ouvert_par_beat', 'beat_splits_un_email_ouvert_par_beat');
--  -- les deux définitions doivent de nouveau contenir 'refusee'
