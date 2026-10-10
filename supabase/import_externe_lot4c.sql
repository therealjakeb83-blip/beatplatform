-- Import de commandes externes — lot 4 (suite, demande de Jake en testant un
-- fichier fait maison le 2026-10-10) : la colonne « source / origine » d'un
-- fichier est reliée aux 9 sources marketing du CRM (lib/sources-marketing.ts)
-- et enregistrée sur la commande importée (affichée dans la fiche client et le
-- détail de la commande ; jamais dans Analytics, comme toute vente importée).

BEGIN;

ALTER TABLE commandes_externes ADD COLUMN IF NOT EXISTS source_marketing text
  CHECK (source_marketing IS NULL OR source_marketing IN ('instagram', 'youtube', 'tiktok', 'google', 'google_ads', 'youtube_ads', 'newsletter', 'direct', 'autre'));

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
    -- coordonnées seulement sur les fiches CRÉÉES ici (fiche commune à toutes
    -- les boutiques : jamais celle d'un client existant)
    INSERT INTO clients (id, email, prenom, nom, adresse, ville, code_postal, pays, telephone)
    SELECT gen_random_uuid(), email, coalesce(prenom, ''), coalesce(nom, ''), adresse, ville, code_postal,
      CASE WHEN pays ~ '^[A-Z]{2}$' THEN pays END, telephone
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

COMMIT;

-- ── SELECT de contrôle (à lancer après) ──────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'commandes_externes' AND column_name = 'source_marketing';
-- SELECT pg_get_functiondef('importer_commandes_externes'::regproc) LIKE '%THEN c.source_marketing END%' AS import_avec_source,
--        pg_get_functiondef('importer_commandes_externes'::regproc) LIKE '%moyen_paiement, montant_tva%' AS import_avec_paiement_tva,
--        pg_get_functiondef('importer_commandes_externes'::regproc) LIKE '%adresse, ville, code_postal, pays, telephone%' AS import_avec_coordonnees;
