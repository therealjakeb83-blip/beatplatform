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


-- ── Import : fiche de la boutique remplie, fiche commune = email seul ──────
-- (fonction du lot 4c de l'import, seules les lignes marquées « 9d lot 3 » changent)
CREATE OR REPLACE FUNCTION importer_commandes_externes(
  p_beatmaker_id uuid,
  p_import       jsonb,
  p_contacts     jsonb,
  p_commandes    jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import_id   uuid;
  v_plateforme  text := p_import->>'plateforme';
  v_nb_cmd      integer;
  v_nb_lignes   integer;
  v_nb_contacts integer;
BEGIN
  INSERT INTO imports_externes (beatmaker_id, plateforme, nom_fichier, nom_vendeur, devise, periode_debut, periode_fin, nb_rejetees, nb_ecartees)
  VALUES (
    p_beatmaker_id, v_plateforme, p_import->>'nom_fichier', p_import->>'nom_vendeur', p_import->>'devise',
    (p_import->>'periode_debut')::timestamptz, (p_import->>'periode_fin')::timestamptz,
    coalesce((p_import->>'nb_rejetees')::integer, 0),
    coalesce((p_import->>'nb_ecartees')::integer, 0)
  )
  RETURNING id INTO v_import_id;

  CREATE TEMP TABLE _ic (
    email text PRIMARY KEY, prenom text, nom text, premiere_date timestamptz,
    adresse text, ville text, code_postal text, pays text, telephone text,
    client_id uuid, client_cree boolean NOT NULL DEFAULT false, lead_cree boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  INSERT INTO _ic (email, prenom, nom, premiere_date, adresse, ville, code_postal, pays, telephone)
  SELECT lower(trim(x.email)), x.prenom, x.nom, x.premiere_date,
    nullif(trim(x.adresse), ''), nullif(trim(x.ville), ''), nullif(trim(x.code_postal), ''), nullif(upper(trim(x.pays)), ''), nullif(trim(x.telephone), '')
  FROM jsonb_to_recordset(p_contacts) AS x(email text, prenom text, nom text, premiere_date timestamptz,
    adresse text, ville text, code_postal text, pays text, telephone text)
  ON CONFLICT (email) DO NOTHING;

  UPDATE _ic SET client_id = c.id FROM clients c WHERE c.email = _ic.email;

  WITH ins AS (
    -- 9d lot 3 : la fiche commune ne reçoit que l'email ; les coordonnées du
    -- fichier vont dans la fiche de CETTE boutique (ecrire_fiche_boutique)
    INSERT INTO clients (id, email, nom)
    SELECT gen_random_uuid(), email, ''
    FROM _ic WHERE client_id IS NULL
    RETURNING id, email
  )
  UPDATE _ic SET client_id = ins.id, client_cree = true FROM ins WHERE ins.email = _ic.email;

  WITH insl AS (
    INSERT INTO leads (client_id, beatmaker_id, source, source_plateforme, created_at, newsletter_statut)
    SELECT i.client_id, p_beatmaker_id, 'import', v_plateforme, coalesce(i.premiere_date, now()), 'non_inscrit'
    FROM _ic i
    WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.client_id = i.client_id AND l.beatmaker_id = p_beatmaker_id)
    RETURNING client_id
  )
  UPDATE _ic SET lead_cree = true FROM insl WHERE insl.client_id = _ic.client_id;

  -- 9d lot 3 : fiche de la boutique remplie avec le fichier (données anciennes :
  -- cases vides seulement, listes complétées à la fin)
  PERFORM ecrire_fiche_boutique(i.client_id, p_beatmaker_id, 'import', jsonb_strip_nulls(jsonb_build_object(
      'ancien', true, 'email', i.email, 'prenom', i.prenom, 'nom', i.nom, 'telephone', i.telephone, 'pays', i.pays,
      'adresse', CASE WHEN i.adresse IS NOT NULL OR i.ville IS NOT NULL THEN jsonb_strip_nulls(jsonb_build_object(
        'adresse', i.adresse, 'code_postal', i.code_postal, 'ville', i.ville, 'pays', i.pays)) END)),
    coalesce(i.premiere_date, now()))
  FROM _ic i;

  INSERT INTO imports_externes_contacts (import_id, beatmaker_id, client_id, client_cree, snapshot)
  SELECT v_import_id, p_beatmaker_id, i.client_id, i.client_cree, client_snapshot_import(i.client_id)
  FROM _ic i WHERE i.lead_cree;

  CREATE TEMP TABLE _cmd ON COMMIT DROP AS
  SELECT * FROM jsonb_to_recordset(p_commandes) AS x(
    numero_externe text, date_vente timestamptz, acheteur_email text, acheteur_nom text,
    type_boutique text, reference_paiement text, devise text, taux_change numeric, date_taux date,
    total_catalogue numeric, total_remise numeric, total_depense numeric, total_paye numeric,
    total_depense_eur numeric, lignes jsonb, moyen_paiement text, montant_tva numeric, source_marketing text
  );

  CREATE TEMP TABLE _ins (id uuid, numero_externe text) ON COMMIT DROP;

  WITH ins AS (
    INSERT INTO commandes_externes (
      import_id, beatmaker_id, client_id, plateforme, numero_externe, date_vente, acheteur_email,
      acheteur_nom, type_boutique, reference_paiement, devise, taux_change, date_taux,
      total_catalogue, total_remise, total_depense, total_paye, total_depense_eur, moyen_paiement, montant_tva,
      source_marketing
    )
    SELECT v_import_id, p_beatmaker_id, i.client_id, v_plateforme, c.numero_externe, c.date_vente,
      lower(trim(c.acheteur_email)), c.acheteur_nom, c.type_boutique, c.reference_paiement, c.devise,
      c.taux_change, c.date_taux, c.total_catalogue, c.total_remise, c.total_depense, c.total_paye,
      c.total_depense_eur, nullif(trim(c.moyen_paiement), ''), c.montant_tva,
      CASE WHEN c.source_marketing IN ('instagram', 'youtube', 'tiktok', 'google', 'google_ads', 'youtube_ads', 'newsletter', 'direct', 'autre')
        THEN c.source_marketing END
    FROM _cmd c JOIN _ic i ON i.email = lower(trim(c.acheteur_email))
    ON CONFLICT (beatmaker_id, plateforme, numero_externe) DO NOTHING
    RETURNING id, numero_externe
  )
  INSERT INTO _ins SELECT id, numero_externe FROM ins;

  INSERT INTO commandes_externes_lignes (
    commande_externe_id, beatmaker_id, ordre, titre, titre_original, licence, prix_catalogue, remise,
    montant_depense, montant_paye, montant_depense_eur, offert, vendeur_principal, collaborateurs, beat_id,
    licence_id
  )
  SELECT n.id, p_beatmaker_id, l.ordre, l.titre, l.titre_original, l.licence, l.prix_catalogue, l.remise,
    l.montant_depense, l.montant_paye, l.montant_depense_eur, coalesce(l.offert, false), l.vendeur_principal,
    coalesce(l.collaborateurs, '{}'),
    (SELECT b.id FROM beats b WHERE b.id = l.beat_id AND b.beatmaker_id = p_beatmaker_id),
    (SELECT li.id FROM licences li WHERE li.id = l.licence_id AND li.beatmaker_id = p_beatmaker_id)
  FROM _cmd c
  JOIN _ins n ON n.numero_externe = c.numero_externe
  CROSS JOIN LATERAL jsonb_to_recordset(c.lignes) AS l(
    ordre integer, titre text, titre_original text, licence text, prix_catalogue numeric, remise numeric,
    montant_depense numeric, montant_paye numeric, montant_depense_eur numeric, offert boolean,
    vendeur_principal text, collaborateurs text[], beat_id uuid, licence_id uuid
  );

  SELECT count(*) INTO v_nb_cmd FROM _ins;
  SELECT count(*) INTO v_nb_lignes FROM commandes_externes_lignes cl JOIN _ins n ON n.id = cl.commande_externe_id;
  SELECT count(*) INTO v_nb_contacts FROM _ic WHERE lead_cree;

  UPDATE imports_externes SET
    nb_commandes      = v_nb_cmd,
    nb_lignes         = v_nb_lignes,
    nb_contacts_crees = v_nb_contacts,
    total_depense     = coalesce((SELECT sum(ce.total_depense) FROM commandes_externes ce JOIN _ins n ON n.id = ce.id), 0),
    total_depense_eur = coalesce((SELECT sum(ce.total_depense_eur) FROM commandes_externes ce JOIN _ins n ON n.id = ce.id), 0)
  WHERE id = v_import_id;

  RETURN jsonb_build_object(
    'import_id', v_import_id,
    'nb_commandes', v_nb_cmd,
    'nb_lignes', v_nb_lignes,
    'nb_contacts_crees', v_nb_contacts,
    'nb_clients_crees', (SELECT count(*) FROM _ic WHERE client_cree)
  );
END;
$$;

REVOKE ALL ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) TO service_role;

-- ── Annulation d'un import : une fiche modifiée à la main est conservée ────
-- (fonction du lot 2 de l'import, seule la garde « champs_manuels » s'ajoute)
CREATE OR REPLACE FUNCTION annuler_import_externe(p_beatmaker_id uuid, p_import_id uuid) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import        imports_externes%ROWTYPE;
  v_nb_cmd        integer;
  v_supprimes     integer := 0;
  v_conserves     integer := 0;
  r               record;
  v_garde         boolean;
BEGIN
  SELECT * INTO v_import FROM imports_externes
  WHERE id = p_import_id AND beatmaker_id = p_beatmaker_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'import_introuvable'; END IF;
  IF v_import.statut <> 'importe' THEN RAISE EXCEPTION 'import_deja_annule'; END IF;

  DELETE FROM commandes_externes WHERE import_id = p_import_id;
  GET DIAGNOSTICS v_nb_cmd = ROW_COUNT;

  FOR r IN SELECT * FROM imports_externes_contacts WHERE import_id = p_import_id LOOP
    v_garde :=
         EXISTS (SELECT 1 FROM commandes WHERE beatmaker_id = p_beatmaker_id AND client_id = r.client_id)
      OR EXISTS (SELECT 1 FROM commandes_externes WHERE beatmaker_id = p_beatmaker_id AND client_id = r.client_id)
      OR EXISTS (SELECT 1 FROM abonnements_boutique WHERE beatmaker_id = p_beatmaker_id AND client_id = r.client_id)
      OR EXISTS (SELECT 1 FROM leads WHERE beatmaker_id = p_beatmaker_id AND client_id = r.client_id
                   AND (newsletter_statut <> 'non_inscrit' OR newsletter_statut_at IS NOT NULL OR source <> 'import'
                        OR cardinality(champs_manuels) > 0))
      OR EXISTS (SELECT 1 FROM listes_crm_contacts lc JOIN listes_crm li ON li.id = lc.liste_id
                   WHERE li.beatmaker_id = p_beatmaker_id AND lc.client_id = r.client_id)
      OR EXISTS (SELECT 1 FROM fusions_crm WHERE beatmaker_id = p_beatmaker_id
                   AND (client_id_conserve = r.client_id OR client_id_archive = r.client_id))
      OR EXISTS (SELECT 1 FROM free_downloads WHERE beatmaker_id = p_beatmaker_id AND client_id = r.client_id)
      OR EXISTS (SELECT 1 FROM morceaux_clients WHERE beatmaker_id = p_beatmaker_id AND client_id = r.client_id)
      OR client_snapshot_import(r.client_id) IS DISTINCT FROM r.snapshot;

    IF v_garde THEN
      v_conserves := v_conserves + 1;
    ELSE
      DELETE FROM leads WHERE beatmaker_id = p_beatmaker_id AND client_id = r.client_id;
      v_supprimes := v_supprimes + 1;
      IF r.client_cree THEN
        DELETE FROM imports_externes_contacts WHERE import_id = p_import_id AND client_id = r.client_id;
        IF NOT client_reference_ailleurs(r.client_id) THEN
          DELETE FROM clients WHERE id = r.client_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  UPDATE imports_externes SET
    statut = 'annule',
    annule_at = now(),
    annulation_rapport = jsonb_build_object(
      'nb_commandes_supprimees', v_nb_cmd,
      'nb_contacts_supprimes', v_supprimes,
      'nb_contacts_conserves', v_conserves
    )
  WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'nb_commandes_supprimees', v_nb_cmd,
    'nb_contacts_supprimes', v_supprimes,
    'nb_contacts_conserves', v_conserves
  );
END;
$$;

REVOKE ALL ON FUNCTION annuler_import_externe(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION annuler_import_externe(uuid, uuid) TO service_role;

COMMIT;

-- ── SELECT de contrôle (onglet séparé, après exécution) ───────────────────
-- SELECT
--   has_function_privilege('authenticated', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)', 'EXECUTE') AS authenticated_peut,
--   has_function_privilege('anon', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)', 'EXECUTE') AS anon_peut,
--   pg_get_functiondef('fusionner_compte_client'::regproc) LIKE '%commandes_externes%' AS fusion_complete,
--   pg_get_functiondef('importer_commandes_externes'::regproc) LIKE '%ecrire_fiche_boutique%' AS import_remplit_fiche,
--   pg_get_functiondef('annuler_import_externe'::regproc) LIKE '%champs_manuels%' AS annulation_garde_main;
