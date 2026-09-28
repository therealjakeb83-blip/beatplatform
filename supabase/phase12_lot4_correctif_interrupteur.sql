-- ============================================================
-- PHASE 12 — LOT 4 : correctif de l'interrupteur « ventes collab »
-- Bug trouvé au test T3 (2026-09-28) : le recalcul des beats était lancé
-- par un trigger BEFORE UPDATE, donc AVANT que la nouvelle valeur de
-- l'interrupteur soit enregistrée — recalculer_collaboration_beat relisait
-- l'ancienne valeur et basculer l'interrupteur ne changeait rien.
-- Correctif : horodatage en BEFORE, recalcul en AFTER UPDATE.
-- À exécuter dans l'éditeur SQL Supabase, en UNE seule fois (une transaction).
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS parametres_plateforme_recalcul ON parametres_plateforme;

CREATE OR REPLACE FUNCTION parametres_plateforme_horodatage_trg() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER parametres_plateforme_horodatage
  BEFORE UPDATE ON parametres_plateforme
  FOR EACH ROW EXECUTE FUNCTION parametres_plateforme_horodatage_trg();

CREATE OR REPLACE FUNCTION parametres_plateforme_recalcul_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT beat_id FROM beat_splits LOOP
    PERFORM recalculer_collaboration_beat(r.beat_id);
  END LOOP;
  RETURN NULL;
END $$;

CREATE TRIGGER parametres_plateforme_recalcul
  AFTER UPDATE OF ventes_collab_actives ON parametres_plateforme
  FOR EACH ROW
  WHEN (OLD.ventes_collab_actives IS DISTINCT FROM NEW.ventes_collab_actives)
  EXECUTE FUNCTION parametres_plateforme_recalcul_trg();

-- Remise à niveau avec la valeur actuelle de l'interrupteur.
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
-- select tgname, tgtype from pg_trigger
--  where tgrelid = 'parametres_plateforme'::regclass and not tgisinternal;
--  -- 2 lignes : parametres_plateforme_horodatage et parametres_plateforme_recalcul
