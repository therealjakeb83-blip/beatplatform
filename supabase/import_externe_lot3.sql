-- Import de commandes externes — lot 3 : inscription groupée à la newsletter
-- + relier les beats importés au catalogue.
--   liens_titres_externes          : mémoire des liens par beatmaker (clé = titre
--                                    normalisé côté JS : casse, accents, espaces)
--                                    « relier » à un beat ou « ne_pas_relier »
--   inscriptions_newsletter_groupees : trace de chaque inscription groupée
--                                    (quand, quels contacts, texte confirmé)
-- Écriture uniquement par les fonctions ci-dessous (une transaction chacune).
-- importer_commandes_externes reprend maintenant le beat_id de chaque ligne
-- (mémoire réappliquée aux imports suivants), vérifié contre le catalogue.

BEGIN;

-- ── Mémoire des liens titre → beat ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS liens_titres_externes (
  beatmaker_id  uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  cle           text NOT NULL,
  decision      text NOT NULL CHECK (decision IN ('relier', 'ne_pas_relier')),
  beat_id       uuid REFERENCES beats(id) ON DELETE CASCADE,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (beatmaker_id, cle),
  CHECK ((decision = 'relier') = (beat_id IS NOT NULL))
);

-- ── Trace des inscriptions groupées ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inscriptions_newsletter_groupees (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id            uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  texte_confirmation      text NOT NULL,
  client_ids              uuid[] NOT NULL,
  inscrits_ids            uuid[] NOT NULL DEFAULT '{}',
  nb_inscrits             integer NOT NULL DEFAULT 0,
  nb_deja_inscrits        integer NOT NULL DEFAULT 0,
  nb_desinscrits_ignores  integer NOT NULL DEFAULT 0,
  nb_hors_boutique        integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS inscriptions_newsletter_groupees_bm_idx ON inscriptions_newsletter_groupees (beatmaker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commandes_externes_lignes_titre_idx ON commandes_externes_lignes (beatmaker_id, titre);

ALTER TABLE liens_titres_externes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscriptions_newsletter_groupees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS liens_titres_externes_select_own ON liens_titres_externes;
CREATE POLICY liens_titres_externes_select_own ON liens_titres_externes
  FOR SELECT TO authenticated USING (beatmaker_id = auth.uid());
DROP POLICY IF EXISTS inscriptions_newsletter_groupees_select_own ON inscriptions_newsletter_groupees;
CREATE POLICY inscriptions_newsletter_groupees_select_own ON inscriptions_newsletter_groupees
  FOR SELECT TO authenticated USING (beatmaker_id = auth.uid());

GRANT SELECT ON liens_titres_externes, inscriptions_newsletter_groupees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON liens_titres_externes, inscriptions_newsletter_groupees TO service_role;

-- ── Relier / ne pas relier / défaire des titres (une seule transaction) ──
-- p_liens : [{ cle, titres: [titres bruts de la clé], action: 'relier'|'ne_pas_relier'|'defaire', beat_id }]
-- S'applique à TOUTES les lignes importées portant ces titres.
CREATE OR REPLACE FUNCTION relier_titres_externes(p_beatmaker_id uuid, p_liens jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l          record;
  v_titres   text[];
  v_n        integer;
  v_lignes   integer := 0;
  v_nb       integer := 0;
BEGIN
  FOR l IN SELECT * FROM jsonb_to_recordset(p_liens) AS x(cle text, titres jsonb, action text, beat_id uuid) LOOP
    IF l.cle IS NULL OR l.cle = '' THEN RAISE EXCEPTION 'cle_vide'; END IF;
    v_titres := ARRAY(SELECT jsonb_array_elements_text(coalesce(l.titres, '[]'::jsonb)));

    IF l.action = 'relier' THEN
      IF NOT EXISTS (SELECT 1 FROM beats WHERE id = l.beat_id AND beatmaker_id = p_beatmaker_id) THEN
        RAISE EXCEPTION 'beat_introuvable';
      END IF;
      INSERT INTO liens_titres_externes (beatmaker_id, cle, decision, beat_id, updated_at)
      VALUES (p_beatmaker_id, l.cle, 'relier', l.beat_id, now())
      ON CONFLICT (beatmaker_id, cle) DO UPDATE SET decision = 'relier', beat_id = l.beat_id, updated_at = now();
      UPDATE commandes_externes_lignes SET beat_id = l.beat_id
      WHERE beatmaker_id = p_beatmaker_id AND titre = ANY(v_titres);
    ELSIF l.action = 'ne_pas_relier' THEN
      INSERT INTO liens_titres_externes (beatmaker_id, cle, decision, beat_id, updated_at)
      VALUES (p_beatmaker_id, l.cle, 'ne_pas_relier', NULL, now())
      ON CONFLICT (beatmaker_id, cle) DO UPDATE SET decision = 'ne_pas_relier', beat_id = NULL, updated_at = now();
      UPDATE commandes_externes_lignes SET beat_id = NULL
      WHERE beatmaker_id = p_beatmaker_id AND titre = ANY(v_titres);
    ELSIF l.action = 'defaire' THEN
      DELETE FROM liens_titres_externes WHERE beatmaker_id = p_beatmaker_id AND cle = l.cle;
      UPDATE commandes_externes_lignes SET beat_id = NULL
      WHERE beatmaker_id = p_beatmaker_id AND titre = ANY(v_titres);
    ELSE
      RAISE EXCEPTION 'action_inconnue';
    END IF;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_lignes := v_lignes + v_n;
    v_nb := v_nb + 1;
  END LOOP;

  RETURN jsonb_build_object('nb_titres', v_nb, 'nb_lignes', v_lignes);
END;
$$;

-- ── Inscription groupée à la newsletter (une seule transaction) ──────────
-- Statut d'un contact = celui que montre le CRM : fiche conservée + fiches
-- fusionnées dedans, le choix exprimé le plus récemment l'emporte.
--   désinscrit (par lui-même) → JAMAIS réinscrit, compté à part
--   inscrit                   → déjà inscrit
--   non inscrit               → inscrit (lead de la fiche conservée, créé s'il manque)
-- Contact sans aucun lien avec la boutique → ignoré (hors boutique).
-- p_simulation = true : décompte seul, rien n'est écrit. Aucun email envoyé.
CREATE OR REPLACE FUNCTION inscrire_newsletter_groupe(
  p_beatmaker_id uuid,
  p_client_ids   uuid[],
  p_texte        text,
  p_simulation   boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inscrits  uuid[];
  v_deja      integer;
  v_desinscr  integer;
  v_hors      integer;
BEGIN
  CREATE TEMP TABLE _sel ON COMMIT DROP AS
  WITH ids AS (SELECT DISTINCT unnest(p_client_ids) AS client_id),
  groupe AS (
    SELECT i.client_id, i.client_id AS membre FROM ids i
    UNION
    SELECT i.client_id, f.client_id_archive FROM ids i
    JOIN fusions_crm f ON f.beatmaker_id = p_beatmaker_id AND f.client_id_conserve = i.client_id
  ),
  choix AS (
    SELECT DISTINCT ON (g.client_id) g.client_id, l.newsletter_statut
    FROM groupe g
    JOIN leads l ON l.beatmaker_id = p_beatmaker_id AND l.client_id = g.membre
    WHERE l.newsletter_statut IN ('inscrit', 'desinscrit')
    ORDER BY g.client_id, coalesce(l.newsletter_statut_at, 'epoch'::timestamptz) DESC
  )
  SELECT
    i.client_id,
    coalesce(c.newsletter_statut, 'non_inscrit') AS statut,
    (   EXISTS (SELECT 1 FROM groupe g JOIN leads l ON l.beatmaker_id = p_beatmaker_id AND l.client_id = g.membre WHERE g.client_id = i.client_id)
     OR EXISTS (SELECT 1 FROM commandes WHERE beatmaker_id = p_beatmaker_id AND client_id = i.client_id)
     OR EXISTS (SELECT 1 FROM commandes_externes WHERE beatmaker_id = p_beatmaker_id AND client_id = i.client_id)
     OR EXISTS (SELECT 1 FROM abonnements_boutique WHERE beatmaker_id = p_beatmaker_id AND client_id = i.client_id)
    ) AS dans_boutique
  FROM ids i LEFT JOIN choix c ON c.client_id = i.client_id;

  SELECT count(*) INTO v_hors     FROM _sel WHERE NOT dans_boutique;
  SELECT count(*) INTO v_deja     FROM _sel WHERE dans_boutique AND statut = 'inscrit';
  SELECT count(*) INTO v_desinscr FROM _sel WHERE dans_boutique AND statut = 'desinscrit';
  v_inscrits := ARRAY(SELECT client_id FROM _sel WHERE dans_boutique AND statut = 'non_inscrit');

  IF NOT p_simulation THEN
    IF coalesce(trim(p_texte), '') = '' THEN RAISE EXCEPTION 'confirmation_manquante'; END IF;

    UPDATE leads SET newsletter_statut = 'inscrit', newsletter_statut_at = now(), newsletter_statut_source = 'inscription_groupee'
    WHERE beatmaker_id = p_beatmaker_id AND client_id = ANY(v_inscrits);

    INSERT INTO leads (client_id, beatmaker_id, source, newsletter_statut, newsletter_statut_at, newsletter_statut_source)
    SELECT s, p_beatmaker_id, 'achat', 'inscrit', now(), 'inscription_groupee'
    FROM unnest(v_inscrits) AS s
    WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.beatmaker_id = p_beatmaker_id AND l.client_id = s);

    INSERT INTO inscriptions_newsletter_groupees (
      beatmaker_id, texte_confirmation, client_ids, inscrits_ids,
      nb_inscrits, nb_deja_inscrits, nb_desinscrits_ignores, nb_hors_boutique
    ) VALUES (
      p_beatmaker_id, p_texte, p_client_ids, v_inscrits,
      coalesce(array_length(v_inscrits, 1), 0), v_deja, v_desinscr, v_hors
    );
  END IF;

  RETURN jsonb_build_object(
    'nb_inscrits', coalesce(array_length(v_inscrits, 1), 0),
    'nb_deja_inscrits', v_deja,
    'nb_desinscrits_ignores', v_desinscr,
    'nb_hors_boutique', v_hors
  );
END;
$$;

-- ── Import : beat_id repris de la mémoire des liens ──────────────────────
-- Identique au lot 2, sauf : chaque ligne peut porter un beat_id (calculé par
-- le serveur depuis liens_titres_externes), gardé seulement s'il appartient
-- au catalogue du beatmaker.
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
  INSERT INTO imports_externes (beatmaker_id, plateforme, nom_fichier, nom_vendeur, devise, periode_debut, periode_fin, nb_rejetees)
  VALUES (
    p_beatmaker_id, v_plateforme, p_import->>'nom_fichier', p_import->>'nom_vendeur', p_import->>'devise',
    (p_import->>'periode_debut')::timestamptz, (p_import->>'periode_fin')::timestamptz,
    coalesce((p_import->>'nb_rejetees')::integer, 0)
  )
  RETURNING id INTO v_import_id;

  CREATE TEMP TABLE _ic (
    email text PRIMARY KEY, prenom text, nom text, premiere_date timestamptz,
    client_id uuid, client_cree boolean NOT NULL DEFAULT false, lead_cree boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  INSERT INTO _ic (email, prenom, nom, premiere_date)
  SELECT lower(trim(x.email)), x.prenom, x.nom, x.premiere_date
  FROM jsonb_to_recordset(p_contacts) AS x(email text, prenom text, nom text, premiere_date timestamptz)
  ON CONFLICT (email) DO NOTHING;

  UPDATE _ic SET client_id = c.id FROM clients c WHERE c.email = _ic.email;

  WITH ins AS (
    INSERT INTO clients (id, email, prenom, nom)
    SELECT gen_random_uuid(), email, coalesce(prenom, ''), coalesce(nom, '')
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
    total_depense_eur numeric, lignes jsonb
  );

  CREATE TEMP TABLE _ins (id uuid, numero_externe text) ON COMMIT DROP;

  WITH ins AS (
    INSERT INTO commandes_externes (
      import_id, beatmaker_id, client_id, plateforme, numero_externe, date_vente, acheteur_email,
      acheteur_nom, type_boutique, reference_paiement, devise, taux_change, date_taux,
      total_catalogue, total_remise, total_depense, total_paye, total_depense_eur
    )
    SELECT v_import_id, p_beatmaker_id, i.client_id, v_plateforme, c.numero_externe, c.date_vente,
      lower(trim(c.acheteur_email)), c.acheteur_nom, c.type_boutique, c.reference_paiement, c.devise,
      c.taux_change, c.date_taux, c.total_catalogue, c.total_remise, c.total_depense, c.total_paye,
      c.total_depense_eur
    FROM _cmd c JOIN _ic i ON i.email = lower(trim(c.acheteur_email))
    ON CONFLICT (beatmaker_id, plateforme, numero_externe) DO NOTHING
    RETURNING id, numero_externe
  )
  INSERT INTO _ins SELECT id, numero_externe FROM ins;

  INSERT INTO commandes_externes_lignes (
    commande_externe_id, beatmaker_id, ordre, titre, titre_original, licence, prix_catalogue, remise,
    montant_depense, montant_paye, montant_depense_eur, offert, vendeur_principal, collaborateurs, beat_id
  )
  SELECT n.id, p_beatmaker_id, l.ordre, l.titre, l.titre_original, l.licence, l.prix_catalogue, l.remise,
    l.montant_depense, l.montant_paye, l.montant_depense_eur, coalesce(l.offert, false), l.vendeur_principal,
    coalesce(l.collaborateurs, '{}'),
    (SELECT b.id FROM beats b WHERE b.id = l.beat_id AND b.beatmaker_id = p_beatmaker_id)
  FROM _cmd c
  JOIN _ins n ON n.numero_externe = c.numero_externe
  CROSS JOIN LATERAL jsonb_to_recordset(c.lignes) AS l(
    ordre integer, titre text, titre_original text, licence text, prix_catalogue numeric, remise numeric,
    montant_depense numeric, montant_paye numeric, montant_depense_eur numeric, offert boolean,
    vendeur_principal text, collaborateurs text[], beat_id uuid
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

REVOKE ALL ON FUNCTION relier_titres_externes(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION inscrire_newsletter_groupe(uuid, uuid[], text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION relier_titres_externes(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION inscrire_newsletter_groupe(uuid, uuid[], text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) TO service_role;

COMMIT;

-- ── SELECT de contrôle (à lancer après) ──────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('liens_titres_externes', 'inscriptions_newsletter_groupees');
-- SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role
--   FROM pg_proc p WHERE p.proname IN ('relier_titres_externes', 'inscrire_newsletter_groupe', 'importer_commandes_externes');
-- SELECT pg_get_functiondef('importer_commandes_externes'::regproc) LIKE '%b.beatmaker_id = p_beatmaker_id%' AS import_avec_beat_id;
