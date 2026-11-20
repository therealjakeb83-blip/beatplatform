-- Rang 9f, Lot 1 — SQL 1 (2026-11-20) : journal de téléchargement + limite d'essais
-- 1. Table des essais ratés d'email par commande (décision 3 bis : 5 essais ratés → bloqué 1 h)
-- 2. Colonne licence_downloads.origine : comment l'acheteur est entré (décision 4 bis)
-- 3. S4 : plus aucune écriture directe dans le journal par un compte connecté
--    (toutes les écritures légitimes passent par la clé de service)
-- Ne fait qu'AJOUTER (sauf S4) : sans risque pour le site actuel.

BEGIN;

CREATE TABLE IF NOT EXISTS public.essais_acces_commande (
  commande_id  uuid PRIMARY KEY,
  essais       integer NOT NULL DEFAULT 0,
  bloque_jusqu timestamptz,
  maj_le       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.essais_acces_commande ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.essais_acces_commande FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.essais_acces_commande TO service_role;

-- Note un essai raté ; au 5e (dans l'heure) la commande est bloquée 1 h.
-- Renvoie la fin du blocage (NULL si pas bloquée).
CREATE OR REPLACE FUNCTION public.noter_essai_acces_commande(p_commande_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v essais_acces_commande%ROWTYPE;
BEGIN
  INSERT INTO essais_acces_commande AS e (commande_id, essais, maj_le)
  VALUES (p_commande_id, 1, now())
  ON CONFLICT (commande_id) DO UPDATE SET
    essais = CASE
      WHEN e.bloque_jusqu IS NOT NULL AND e.bloque_jusqu <= now() THEN 1
      WHEN e.bloque_jusqu IS NULL AND e.maj_le < now() - interval '1 hour' THEN 1
      ELSE e.essais + 1
    END,
    bloque_jusqu = CASE WHEN e.bloque_jusqu IS NOT NULL AND e.bloque_jusqu <= now() THEN NULL ELSE e.bloque_jusqu END,
    maj_le = now()
  RETURNING * INTO v;

  IF v.bloque_jusqu IS NULL AND v.essais >= 5 THEN
    UPDATE essais_acces_commande SET bloque_jusqu = now() + interval '1 hour', essais = 0
     WHERE commande_id = p_commande_id
    RETURNING bloque_jusqu INTO v.bloque_jusqu;
  END IF;

  RETURN CASE WHEN v.bloque_jusqu > now() THEN v.bloque_jusqu ELSE NULL END;
END $$;
REVOKE ALL ON FUNCTION public.noter_essai_acces_commande(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.noter_essai_acces_commande(uuid) TO service_role;

ALTER TABLE public.licence_downloads ADD COLUMN IF NOT EXISTS origine text;
ALTER TABLE public.licence_downloads DROP CONSTRAINT IF EXISTS licence_downloads_origine_check;
ALTER TABLE public.licence_downloads ADD CONSTRAINT licence_downloads_origine_check
  CHECK (origine IS NULL OR origine IN ('appareil_paiement', 'compte_acheteur', 'lien_email', 'email_tape'));

-- S4 : la politique « FOR ALL » laissait un vendeur connecté écrire ses propres
-- lignes (IP et date au choix). Lecture de SES lignes seulement, plus aucune écriture.
DROP POLICY IF EXISTS licence_downloads_beatmaker_own ON public.licence_downloads;
DROP POLICY IF EXISTS licence_downloads_select_own ON public.licence_downloads;
CREATE POLICY licence_downloads_select_own ON public.licence_downloads
  FOR SELECT TO authenticated USING (auth.uid() = beatmaker_id);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.licence_downloads FROM anon, authenticated;

COMMIT;

-- ─── Vérification (nouvel onglet) ───
-- select
--   (select count(*) from information_schema.tables where table_name = 'essais_acces_commande') as table_essais,
--   (select count(*) from information_schema.columns where table_name = 'licence_downloads' and column_name = 'origine') as colonne_origine,
--   has_table_privilege('authenticated', 'public.licence_downloads', 'INSERT') as connecte_peut_ecrire,
--   (select string_agg(policyname || ':' || cmd, ', ') from pg_policies where tablename = 'licence_downloads') as politiques,
--   has_function_privilege('anon', 'public.noter_essai_acces_commande(uuid)', 'EXECUTE') as visiteur_peut_appeler;
-- Attendu : 1 | 1 | false | licence_downloads_select_own:SELECT | false

-- ─── Pour défaire (SQL inverse) ───
-- BEGIN;
-- DROP POLICY IF EXISTS licence_downloads_select_own ON public.licence_downloads;
-- CREATE POLICY licence_downloads_beatmaker_own ON public.licence_downloads FOR ALL USING (auth.uid() = beatmaker_id);
-- GRANT INSERT ON public.licence_downloads TO authenticated;
-- ALTER TABLE public.licence_downloads DROP CONSTRAINT IF EXISTS licence_downloads_origine_check;
-- ALTER TABLE public.licence_downloads DROP COLUMN IF EXISTS origine;
-- DROP FUNCTION IF EXISTS public.noter_essai_acces_commande(uuid);
-- DROP TABLE IF EXISTS public.essais_acces_commande;
-- COMMIT;
