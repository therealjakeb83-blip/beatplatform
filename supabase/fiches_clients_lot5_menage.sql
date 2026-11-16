-- ============================================================
-- 9d lot 5 — Ménage : la fiche commune `clients` ne garde que le compte Sonoo
-- ============================================================
-- Décisions de Jake (2026-11-16) :
--   (1) option A : Sonoo ne garde plus sur le compte les coordonnées du
--       paiement (elles restent sur la commande et dans la fiche de la boutique) ;
--   (2) option A : une ligne `clients` SANS connexion ne garde que l'email
--       (prénom/nom vidés ; ils vivent sur la commande et dans la fiche boutique).
-- Le code ne lit/écrit plus aucune de ces colonnes (commit ef4550f).
-- Aucune ligne `clients` n'est supprimée.
--
-- Contenu (une seule transaction) :
--   1. supprimer_compte_client : réécrite sans les colonnes retirées
--   2. client_snapshot_import : ne compare plus que l'email (le contrôle
--      « modifié à la main » vit dans la fiche boutique, champs_manuels) ;
--      photos déjà prises réduites à l'email pour rester comparables
--   3. reconstruire_fiches_boutique : supprimée (ne plus jamais la lancer)
--   4. lignes sans connexion : prénom et nom vidés
--   5. 20 colonnes retirées de `clients`
-- ============================================================

BEGIN;

-- ── 1. Supprimer mon compte (lot 4) sans les colonnes retirées ──
CREATE OR REPLACE FUNCTION supprimer_compte_client(p_client_id uuid, p_desinscrire uuid[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_favoris integer;
  v_desinscrits integer;
BEGIN
  PERFORM 1 FROM clients WHERE id = p_client_id AND supprime_le IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'compte_introuvable';
  END IF;
  IF EXISTS (SELECT 1 FROM beatmakers WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'compte_boutique';
  END IF;
  IF EXISTS (SELECT 1 FROM abonnements_boutique WHERE client_id = p_client_id AND statut <> 'annule') THEN
    RAISE EXCEPTION 'abonnement_actif';
  END IF;

  DELETE FROM favoris WHERE client_id = p_client_id;
  GET DIAGNOSTICS v_favoris = ROW_COUNT;

  UPDATE leads SET newsletter_statut = 'desinscrit', newsletter_statut_at = now(),
                   newsletter_statut_source = 'suppression_compte'
   WHERE client_id = p_client_id AND beatmaker_id = ANY(coalesce(p_desinscrire, '{}'))
     AND newsletter_statut <> 'desinscrit' AND efface_le IS NULL;
  GET DIAGNOSTICS v_desinscrits = ROW_COUNT;

  UPDATE clients SET
    email = 'compte-supprime-' || id::text || '@supprime.invalid',
    nom = 'Compte supprimé', prenom = NULL,
    supprime_le = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object('favoris', v_favoris, 'desinscrits', v_desinscrits);
END;
$$;
REVOKE ALL ON FUNCTION supprimer_compte_client(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION supprimer_compte_client(uuid, uuid[]) TO service_role;

-- ── 2. Annuler un import : photo du contact = son email seul ──
CREATE OR REPLACE FUNCTION client_snapshot_import(p_client_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('email', c.email) FROM clients c WHERE c.id = p_client_id;
$$;
REVOKE ALL ON FUNCTION client_snapshot_import(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION client_snapshot_import(uuid) TO service_role;

UPDATE imports_externes_contacts
   SET snapshot = jsonb_build_object('email', snapshot -> 'email')
 WHERE snapshot IS DISTINCT FROM jsonb_build_object('email', snapshot -> 'email');

-- ── 3. Reconstruction du lot 1 : supprimée ──
DROP FUNCTION IF EXISTS reconstruire_fiches_boutique(boolean);

-- ── 4. Ligne sans connexion = email seul ──
UPDATE clients c
   SET prenom = NULL, nom = ''
 WHERE c.supprime_le IS NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id)
   AND (c.prenom IS NOT NULL OR c.nom <> '');

-- ── 5. Colonnes CRM retirées ──
ALTER TABLE clients
  DROP COLUMN IF EXISTS nom_artiste,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS telephone,
  DROP COLUMN IF EXISTS langue,
  DROP COLUMN IF EXISTS date_dernier_login,
  DROP COLUMN IF EXISTS adresse,
  DROP COLUMN IF EXISTS ville,
  DROP COLUMN IF EXISTS code_postal,
  DROP COLUMN IF EXISTS pays,
  DROP COLUMN IF EXISTS instagram,
  DROP COLUMN IF EXISTS spotify,
  DROP COLUMN IF EXISTS youtube,
  DROP COLUMN IF EXISTS tiktok,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS emails_secondaires,
  DROP COLUMN IF EXISTS surnom,
  DROP COLUMN IF EXISTS type_client,
  DROP COLUMN IF EXISTS raison_sociale,
  DROP COLUMN IF EXISTS numero_tva;

NOTIFY pgrst, 'reload schema';

COMMIT;
