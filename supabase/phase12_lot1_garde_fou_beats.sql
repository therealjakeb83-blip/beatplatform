-- ============================================================
-- PHASE 12 — LOT 1 : garde-fou contre l'effacement RÉEL d'un beat
--
-- L'interface ne fait jamais d'effacement réel (suppression douce :
-- beats.supprime_le). Mais tant que des clés étrangères en « ON DELETE CASCADE »
-- relient un beat à ses collaborations, ses écoutes et ses licences, un
-- effacement réel fait à la main (SQL, script) détruirait silencieusement
-- l'historique de A ET de ses collaborateurs.
--
-- Règle : impossible d'effacer un beat qui a au moins une vente ou au moins une
-- collaboration (même terminée). Un beat vierge (jamais vendu, jamais partagé)
-- reste effaçable.
--
-- À exécuter APRÈS phase12_lot1_collaborations.sql (une transaction).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION empecher_effacement_beat() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM commande_lignes WHERE beat_id = OLD.id)
     OR EXISTS (SELECT 1 FROM beat_splits WHERE beat_id = OLD.id) THEN
    RAISE EXCEPTION 'Effacement impossible : ce beat a des ventes ou des collaborations. Utilise la suppression douce (beats.supprime_le).'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS beats_garde_fou_effacement ON beats;
CREATE TRIGGER beats_garde_fou_effacement
  BEFORE DELETE ON beats
  FOR EACH ROW EXECUTE FUNCTION empecher_effacement_beat();

COMMIT;

-- ============================================================
-- TEST (à lancer dans l'éditeur SQL — rien n'est conservé : tout est annulé) :
--
--   BEGIN;
--   -- prends l'id d'un beat qui a au moins une vente :
--   --   select beat_id from commande_lignes limit 1;
--   DELETE FROM beats WHERE id = '<cet id>';   -- doit échouer avec « Effacement impossible »
--   ROLLBACK;
-- ============================================================
