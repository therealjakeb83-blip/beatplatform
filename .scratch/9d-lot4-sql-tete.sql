-- Rang 9d, lot 4 — SQL : RGPD (effacer un contact, supprimer un compte Sonoo).
--
-- Rôle (décision de Jake, 2026-11-16) : pour les fiches des boutiques, Sonoo
-- est sous-traitant ; seule la boutique efface un contact. Pour le compte
-- Sonoo, Sonoo est responsable ; la ligne `clients` est ANONYMISÉE, jamais
-- supprimée (cascades vers les données des boutiques).
--
-- 1. Colonnes : leads.efface_le, clients.supprime_le,
--    licence_downloads.ip_effacer_apres (IP gardée 120 jours après l'achat
--    comme preuve en cas de contestation bancaire, puis effacée la nuit),
--    commandes_externes.acheteur_email et email_logs.destinataire peuvent
--    être vides, journal des décisions : type « client ».
-- 2. effacer_contact_boutique : geste du beatmaker, dans SA boutique ; une
--    transaction ; refus si abonnement non annulé.
-- 3. supprimer_compte_client : anonymise `clients`, supprime les favoris,
--    désinscrit la newsletter des boutiques cochées ; refus si abonnement non
--    annulé ou si la connexion est aussi une boutique. La connexion
--    (auth.users) est supprimée ensuite par le code (API Supabase).
-- 4. ecrire_fiche_boutique : une fiche effacée repart de zéro (fiche neuve).

BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS efface_le timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS supprime_le timestamptz;
ALTER TABLE licence_downloads ADD COLUMN IF NOT EXISTS ip_effacer_apres timestamptz;
ALTER TABLE commandes_externes ALTER COLUMN acheteur_email DROP NOT NULL;
ALTER TABLE email_logs ALTER COLUMN destinataire DROP NOT NULL;

ALTER TABLE merchant_decisions_log DROP CONSTRAINT IF EXISTS merchant_decisions_log_entity_type_check;
ALTER TABLE merchant_decisions_log ADD CONSTRAINT merchant_decisions_log_entity_type_check
  CHECK (entity_type IN ('commande', 'boutique', 'page_legale', 'licence_texte', 'collaboration', 'client'));

-- ── Effacer un contact (dans UNE boutique) ────────────────────────────────
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
  SELECT client_id_conserve INTO v_principal FROM fusions_crm
   WHERE beatmaker_id = p_beatmaker_id AND client_id_archive = p_client_id LIMIT 1;
  v_principal := coalesce(v_principal, p_client_id);
  v_ids := ARRAY[v_principal] || coalesce((SELECT array_agg(DISTINCT client_id_archive) FROM fusions_crm
             WHERE beatmaker_id = p_beatmaker_id AND client_id_conserve = v_principal), '{}');

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

-- ── Supprimer un compte Sonoo (anonymiser, jamais supprimer la ligne) ─────
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
    nom = 'Compte supprimé', prenom = NULL, surnom = NULL, nom_artiste = NULL,
    telephone = NULL, adresse = NULL, ville = NULL, code_postal = NULL, pays = NULL, langue = NULL,
    raison_sociale = NULL, numero_tva = NULL, notes = NULL, tags = '{}',
    instagram = NULL, spotify = NULL, youtube = NULL, tiktok = NULL, emails_secondaires = '{}',
    supprime_le = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object('favoris', v_favoris, 'desinscrits', v_desinscrits);
END;
$$;

REVOKE ALL ON FUNCTION supprimer_compte_client(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION supprimer_compte_client(uuid, uuid[]) TO service_role;

