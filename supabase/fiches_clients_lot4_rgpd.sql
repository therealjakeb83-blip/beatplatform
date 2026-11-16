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

-- ── Fiche effacée qui revient = fiche neuve (fonction du lot 3 + ajout) ──
CREATE OR REPLACE FUNCTION ecrire_fiche_boutique(
  p_client_id    uuid,
  p_beatmaker_id uuid,
  p_source       text,
  p_donnees      jsonb DEFAULT '{}'::jsonb,
  p_le           timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l         leads%ROWTYPE;
  v_id      uuid;
  v_manu    text[];
  v_ancien  boolean := coalesce((p_donnees ->> 'ancien')::boolean, false);
  v_le      timestamptz := coalesce(p_le, now());
  v_email   text := nullif(lower(trim(p_donnees ->> 'email')), '');
  v_tel     text := nullif(trim(p_donnees ->> 'telephone'), '');
  v_prenom  text := nullif(trim(p_donnees ->> 'prenom'), '');
  v_nom     text := nullif(trim(p_donnees ->> 'nom'), '');
  v_artiste text := nullif(trim(p_donnees ->> 'nom_artiste'), '');
  v_pays    text := upper(nullif(trim(p_donnees ->> 'pays'), ''));
  v_langue  text := nullif(trim(p_donnees ->> 'langue'), '');
  v_adr     jsonb;
  v_ligne   text;
  v_emails  text[];
  v_tels    text[];
  v_adrs    jsonb;
  n_prenom  text;
  n_nom     text;
  n_artiste text;
  n_pays    text;
  n_langue  text;
  n_premier timestamptz;
  v_neuve   boolean := false;
BEGIN
  IF p_client_id IS NULL OR p_beatmaker_id IS NULL THEN
    RAISE EXCEPTION 'fiche_sans_client_ou_boutique';
  END IF;

  -- Adresse : { ligne?, adresse?, code_postal?, ville?, pays? } → ligne toujours remplie
  IF jsonb_typeof(p_donnees -> 'adresse') = 'object' THEN
    v_adr := jsonb_strip_nulls(jsonb_build_object(
      'adresse',     nullif(trim(p_donnees -> 'adresse' ->> 'adresse'), ''),
      'code_postal', nullif(trim(p_donnees -> 'adresse' ->> 'code_postal'), ''),
      'ville',       nullif(trim(p_donnees -> 'adresse' ->> 'ville'), ''),
      'pays',        upper(nullif(trim(p_donnees -> 'adresse' ->> 'pays'), ''))));
    v_ligne := coalesce(
      nullif(trim(p_donnees -> 'adresse' ->> 'ligne'), ''),
      nullif(concat_ws(', ', v_adr ->> 'adresse',
                             nullif(concat_ws(' ', v_adr ->> 'code_postal', v_adr ->> 'ville'), ''),
                             v_adr ->> 'pays'), ''));
    v_adr := CASE WHEN v_ligne IS NULL THEN NULL ELSE v_adr || jsonb_build_object('ligne', v_ligne) END;
  END IF;
  v_pays := coalesce(v_pays, upper(v_adr ->> 'pays'));
  IF v_pays IS NOT NULL AND v_pays !~ '^[A-Z]{2}$' THEN v_pays := NULL; END IF;

  INSERT INTO leads (client_id, beatmaker_id, source, created_at, premier_contact_le)
  VALUES (p_client_id, p_beatmaker_id, p_source, v_le, v_le)
  ON CONFLICT (client_id, beatmaker_id) DO NOTHING
  RETURNING id INTO v_id;

  SELECT * INTO l FROM leads
   WHERE client_id = p_client_id AND beatmaker_id = p_beatmaker_id
   FOR UPDATE;

  -- 9d lot 4 : contact effacé par la boutique qui revient = fiche neuve
  -- (seulement ce qui est redonné maintenant ; rien d'effacé ne revient)
  IF l.efface_le IS NOT NULL THEN
    UPDATE leads SET efface_le = NULL, source = p_source, created_at = v_le, premier_contact_le = v_le
     WHERE id = l.id
    RETURNING * INTO l;
    v_neuve := true;
  END IF;
  v_manu := coalesce(l.champs_manuels, '{}');

  -- Emails : toujours à la fin, jamais réordonnés
  v_emails := coalesce(l.emails, '{}');
  IF v_email IS NOT NULL AND NOT v_email = ANY(v_emails) THEN
    v_emails := v_emails || v_email;
  END IF;

  -- Téléphones
  v_tels := coalesce(l.telephones, '{}');
  IF v_tel IS NOT NULL THEN
    IF 'telephones' = ANY(v_manu) OR v_ancien THEN
      IF NOT v_tel = ANY(v_tels) THEN v_tels := v_tels || v_tel; END IF;
    ELSE
      v_tels := ARRAY[v_tel] || array_remove(v_tels, v_tel);
    END IF;
  END IF;

  -- Adresses (comparées par leur ligne)
  v_adrs := coalesce(l.adresses, '[]'::jsonb);
  IF v_adr IS NOT NULL THEN
    IF 'adresses' = ANY(v_manu) OR v_ancien THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_adrs) e WHERE e ->> 'ligne' = v_ligne) THEN
        v_adrs := v_adrs || jsonb_build_array(v_adr);
      END IF;
    ELSE
      v_adrs := jsonb_build_array(v_adr) || coalesce(
        (SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(v_adrs) WITH ORDINALITY u(e, i)
          WHERE e ->> 'ligne' IS DISTINCT FROM v_ligne), '[]'::jsonb);
    END IF;
  END IF;

  -- Remplis une fois
  n_prenom  := CASE WHEN 'prenom' = ANY(v_manu) OR coalesce(l.prenom, '') <> '' OR v_prenom IS NULL THEN l.prenom ELSE v_prenom END;
  n_nom     := CASE WHEN 'nom' = ANY(v_manu) OR coalesce(l.nom, '') <> '' OR v_nom IS NULL THEN l.nom ELSE v_nom END;
  n_artiste := CASE WHEN 'nom_artiste' = ANY(v_manu) OR coalesce(l.nom_artiste, '') <> '' OR v_artiste IS NULL THEN l.nom_artiste ELSE v_artiste END;

  -- Dernière valeur
  n_pays   := CASE WHEN 'pays' = ANY(v_manu) OR v_pays IS NULL OR (v_ancien AND coalesce(l.pays, '') <> '') THEN l.pays ELSE v_pays END;
  n_langue := CASE WHEN 'langue' = ANY(v_manu) OR v_langue IS NULL OR (v_ancien AND coalesce(l.langue, '') <> '') THEN l.langue ELSE v_langue END;

  -- Figée
  n_premier := CASE WHEN v_ancien THEN LEAST(coalesce(l.premier_contact_le, v_le), v_le)
                    ELSE coalesce(l.premier_contact_le, v_le) END;

  IF (v_emails, v_tels, v_adrs, n_prenom, n_nom, n_artiste, n_pays, n_langue, n_premier)
     IS DISTINCT FROM
     (l.emails, l.telephones, l.adresses, l.prenom, l.nom, l.nom_artiste, l.pays, l.langue, l.premier_contact_le)
  THEN
    UPDATE leads SET
      emails = v_emails, telephones = v_tels, adresses = v_adrs,
      prenom = n_prenom, nom = n_nom, nom_artiste = n_artiste,
      pays = n_pays, langue = n_langue, premier_contact_le = n_premier
    WHERE id = l.id;
  END IF;

  RETURN jsonb_build_object('lead_id', l.id, 'cree', v_id IS NOT NULL OR v_neuve);
END;
$$;

REVOKE ALL ON FUNCTION ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz) TO service_role;

COMMIT;
