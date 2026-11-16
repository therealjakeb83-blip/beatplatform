-- Rang 9d, lot 4 — SQL 2 (correctif) :
-- 1. la tâche de nuit (clé de service) peut effacer les IP arrivées à échéance ;
-- 2. « Effacer ce contact » suit les fusions en chaîne (A dans B, puis B dans C).
-- Ne modifie aucune donnée.

BEGIN;

GRANT UPDATE (ip_address, ip_effacer_apres) ON licence_downloads TO service_role;

CREATE OR REPLACE FUNCTION effacer_contact_boutique(p_beatmaker_id uuid, p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_principal uuid;
  v_ids       uuid[];
  v_emails    text[];
  v_cmd       integer;
  v_cmd_ids   uuid[];
  v_ip        integer;
BEGIN
  IF p_beatmaker_id IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'effacement_sans_client_ou_boutique';
  END IF;

  -- Le contact affiché = la fiche conservée d'une fusion de cette boutique
  -- (fusions en chaîne suivies : A dans B, puis B dans C → C)
  WITH RECURSIVE haut AS (
    SELECT p_client_id AS id, 0 AS n
    UNION
    SELECT f.client_id_conserve, h.n + 1 FROM fusions_crm f JOIN haut h ON f.client_id_archive = h.id
     WHERE f.beatmaker_id = p_beatmaker_id AND h.n < 20
  ) SELECT id INTO v_principal FROM haut ORDER BY n DESC LIMIT 1;
  WITH RECURSIVE bas AS (
    SELECT v_principal AS id, 0 AS n
    UNION
    SELECT f.client_id_archive, b.n + 1 FROM fusions_crm f JOIN bas b ON f.client_id_conserve = b.id
     WHERE f.beatmaker_id = p_beatmaker_id AND b.n < 20
  ) SELECT array_agg(DISTINCT id) INTO v_ids FROM bas;

  PERFORM 1 FROM leads WHERE beatmaker_id = p_beatmaker_id AND client_id = ANY(v_ids) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact_hors_boutique';
  END IF;

  IF EXISTS (SELECT 1 FROM abonnements_boutique
              WHERE beatmaker_id = p_beatmaker_id AND client_id = ANY(v_ids) AND statut <> 'annule') THEN
    RAISE EXCEPTION 'abonnement_actif';
  END IF;

  -- Toutes les adresses connues de la boutique pour ce contact
  SELECT coalesce(array_agg(DISTINCT e), '{}') INTO v_emails FROM (
    SELECT unnest(emails) AS e FROM leads WHERE beatmaker_id = p_beatmaker_id AND client_id = ANY(v_ids)
    UNION SELECT unnest(emails_archives) FROM fusions_crm WHERE beatmaker_id = p_beatmaker_id
             AND (client_id_conserve = ANY(v_ids) OR client_id_archive = ANY(v_ids))
    UNION SELECT lower(email) FROM clients WHERE id = ANY(v_ids)
  ) t WHERE e IS NOT NULL AND e <> '';

  -- Fiche vidée (la ligne reste : elle porte « Contact effacé le … »)
  UPDATE leads SET
    emails = '{}', telephones = '{}', adresses = '[]'::jsonb,
    prenom = NULL, nom = NULL, nom_artiste = NULL, pays = NULL, langue = NULL,
    notes = NULL, tags = '{}', surnom = NULL,
    instagram = NULL, spotify = NULL, youtube = NULL, tiktok = NULL,
    champs_manuels = '{}', source_plateforme = NULL,
    newsletter_statut = 'non_inscrit', newsletter_statut_at = NULL, newsletter_statut_source = NULL,
    efface_le = now()
  WHERE beatmaker_id = p_beatmaker_id AND client_id = ANY(v_ids);

  -- Liens internes de la boutique retirés
  DELETE FROM fusions_crm WHERE beatmaker_id = p_beatmaker_id
     AND (client_id_conserve = ANY(v_ids) OR client_id_archive = ANY(v_ids));
  DELETE FROM doublons_ignores WHERE beatmaker_id = p_beatmaker_id
     AND (client_id_1 = ANY(v_ids) OR client_id_2 = ANY(v_ids));
  DELETE FROM listes_crm_contacts WHERE client_id = ANY(v_ids)
     AND liste_id IN (SELECT id FROM listes_crm WHERE beatmaker_id = p_beatmaker_id);
  DELETE FROM liste_membres WHERE client_id = ANY(v_ids)
     AND liste_id IN (SELECT id FROM listes_contacts WHERE beatmaker_id = p_beatmaker_id);
  DELETE FROM morceaux_clients WHERE beatmaker_id = p_beatmaker_id AND client_id = ANY(v_ids);
  DELETE FROM automatisation_evenements WHERE beatmaker_id = p_beatmaker_id
     AND client_id = ANY(v_ids) AND NOT traite;
  UPDATE imports_externes_contacts SET snapshot = '{}'::jsonb
   WHERE beatmaker_id = p_beatmaker_id AND client_id = ANY(v_ids);

  -- Ciblages et codes promo nominatifs de la boutique
  UPDATE campagnes SET cible_emails = ARRAY(SELECT x FROM unnest(cible_emails) x WHERE NOT x = ANY(v_emails))
   WHERE beatmaker_id = p_beatmaker_id AND cible_emails && v_emails;
  UPDATE codes_promo SET
    statut = CASE WHEN cardinality(ARRAY(SELECT x FROM unnest(emails_autorises) x WHERE NOT x = ANY(v_emails))) = 0
                       AND emails_autorises && v_emails THEN 'inactif' ELSE statut END,
    emails_autorises = ARRAY(SELECT x FROM unnest(emails_autorises) x WHERE NOT x = ANY(v_emails)),
    emails_exclus    = ARRAY(SELECT x FROM unnest(emails_exclus) x WHERE NOT x = ANY(v_emails))
   WHERE beatmaker_id = p_beatmaker_id AND (emails_autorises && v_emails OR emails_exclus && v_emails);

  -- Ventes : on garde ce qui est sur la facture, email et téléphone effacés
  SELECT coalesce(array_agg(id), '{}') INTO v_cmd_ids FROM commandes
   WHERE beatmaker_id = p_beatmaker_id
     AND (client_id = ANY(v_ids) OR lower(acheteur_email) = ANY(v_emails));
  UPDATE commandes SET acheteur_email = NULL, acheteur_telephone = NULL WHERE id = ANY(v_cmd_ids);
  v_cmd := cardinality(v_cmd_ids);
  UPDATE abonnements_boutique SET acheteur_email = NULL
   WHERE beatmaker_id = p_beatmaker_id
     AND (client_id = ANY(v_ids) OR lower(acheteur_email) = ANY(v_emails));
  UPDATE tentatives_paiement SET email = NULL, telephone = NULL
   WHERE beatmaker_id = p_beatmaker_id
     AND (client_id = ANY(v_ids) OR lower(email) = ANY(v_emails));
  UPDATE commandes_externes SET acheteur_email = NULL
   WHERE beatmaker_id = p_beatmaker_id
     AND (client_id = ANY(v_ids) OR lower(acheteur_email) = ANY(v_emails));
  UPDATE email_logs SET destinataire = NULL, corps_html = NULL, corps_texte = NULL
   WHERE beatmaker_id = p_beatmaker_id
     AND (client_id = ANY(v_ids) OR lower(destinataire) = ANY(v_emails));

  -- IP des téléchargements : gardée 120 jours après l'achat (preuve en cas de
  -- contestation bancaire), effacée tout de suite au-delà
  UPDATE licence_downloads ld SET
    ip_address       = CASE WHEN c.created_at + interval '120 days' <= now() THEN NULL ELSE ld.ip_address END,
    ip_effacer_apres = CASE WHEN c.created_at + interval '120 days' <= now() THEN NULL ELSE c.created_at + interval '120 days' END
  FROM commandes c
  WHERE ld.commande_id = c.id AND c.id = ANY(v_cmd_ids)
    AND ld.ip_address IS NOT NULL;
  GET DIAGNOSTICS v_ip = ROW_COUNT;

  RETURN jsonb_build_object('client_id', v_principal, 'fiches', cardinality(v_ids),
                            'commandes', v_cmd, 'telechargements', v_ip);
END;
$$;

REVOKE ALL ON FUNCTION effacer_contact_boutique(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION effacer_contact_boutique(uuid, uuid) TO service_role;

COMMIT;
