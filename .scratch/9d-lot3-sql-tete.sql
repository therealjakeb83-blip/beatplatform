-- Rang 9d, lot 3 — SQL 1 : écritures automatiques dans la fiche client PAR boutique.
--
-- 1. ecrire_fiche_boutique : LA fonction d'écriture partagée (site + import).
--    Règles par champ (calibrage du 2026-11-12, points b/c tranchés au lot 3) :
--      emails      : accumulés, une nouvelle adresse va TOUJOURS à la fin
--                    (l'adresse principale = la 1re ne change jamais toute seule)
--      téléphones, adresses : accumulés, la plus récente passe en tête ; si la
--                    liste a été modifiée à la main (ou donnée « ancienne »,
--                    ex. import), la nouvelle valeur va seulement à la fin
--      prénom, nom, nom d'artiste : remplis une fois (case vide seulement)
--      pays, langue : dernière valeur (remplace), sauf champ modifié à la main ;
--                    donnée ancienne (import) : case vide seulement
--      source, date du 1er contact : figées à la création (import : la date
--                    la plus ancienne l'emporte)
--      jamais un champ listé dans champs_manuels (la main du beatmaker gagne)
--    Une seule transaction, verrou sur la fiche : un paiement et une connexion
--    simultanés ne se marchent pas dessus.
-- 2. fusionner_compte_client : 7 liens oubliés au passage invité → vrai compte
--    (ventes importées, fusions de doublons, envois de campagne… supprimés en
--    cascade avec la fiche invitée).
-- 3. importer_commandes_externes : la fiche de la boutique reçoit les
--    coordonnées du fichier ; la fiche commune ne reçoit plus que l'email.
-- 4. annuler_import_externe : une fiche modifiée à la main est conservée.

BEGIN;

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

  RETURN jsonb_build_object('lead_id', l.id, 'cree', v_id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz) TO service_role;

-- ── Passage invité → vrai compte : plus aucun lien perdu ──────────────────
CREATE OR REPLACE FUNCTION fusionner_compte_client(
  id_invite uuid,
  id_reel uuid,
  email_reel text,
  nom_reel text,
  prenom_reel text,
  newsletter_consent_reel boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM clients WHERE id = id_invite FOR UPDATE;

  UPDATE clients SET email = email || '.fusion-tmp-' || id_reel::text WHERE id = id_invite;

  INSERT INTO clients (id, email, nom, prenom)
  VALUES (id_reel, email_reel, COALESCE(nom_reel, id_invite::text), prenom_reel);

  UPDATE commandes SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE abonnements_boutique SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE leads SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE favoris SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE free_downloads SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE licence_downloads SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE tentatives_paiement SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE morceaux_clients SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE beat_plays SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE email_logs SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE listes_crm_contacts SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE doublons_ignores SET client_id_1 = id_reel WHERE client_id_1 = id_invite;
  UPDATE doublons_ignores SET client_id_2 = id_reel WHERE client_id_2 = id_invite;
  UPDATE automatisation_evenements SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE automatisation_envois SET client_id = id_reel WHERE client_id = id_invite;
  -- 9d lot 3 : liens oubliés jusqu'ici (supprimés en cascade avec la fiche invitée)
  UPDATE campagne_envois SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE commandes_externes SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE imports_externes_contacts SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE fusions_crm SET client_id_conserve = id_reel WHERE client_id_conserve = id_invite;
  UPDATE fusions_crm SET client_id_archive = id_reel WHERE client_id_archive = id_invite;
  UPDATE liste_membres SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE clients SET fusionne_dans = id_reel WHERE fusionne_dans = id_invite;

  DELETE FROM clients WHERE id = id_invite;
END;
$$;

REVOKE ALL ON FUNCTION fusionner_compte_client(uuid, uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fusionner_compte_client(uuid, uuid, text, text, text, boolean) TO service_role;

