-- Import de commandes externes — lot 2 : import BeatStars de bout en bout
-- Tables à part, lues UNIQUEMENT par le CRM (jamais Analytics, factures,
-- crons, téléchargement, automatisations).
--   imports_externes            : historique des imports (annulables)
--   commandes_externes          : une ligne par commande (n° de facture BeatStars)
--   commandes_externes_lignes   : une ligne par beat
--   imports_externes_contacts   : contacts créés pour la boutique par un import
--                                 (+ copie de leurs valeurs de départ, pour
--                                 savoir à l'annulation s'ils ont été modifiés)
-- Écriture uniquement par les fonctions importer_commandes_externes /
-- annuler_import_externe (une transaction chacune : tout ou rien).
-- commandes.stripe_invoice_id remplace external_order_id (anti-doublon des
-- paiements d'abonnement) ; plateforme_source / external_order_id seront
-- supprimées par import_externe_lot2_menage.sql une fois le code en ligne.

BEGIN;

-- ── Historique des imports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imports_externes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id        uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  plateforme          text NOT NULL,
  nom_fichier         text,
  nom_vendeur         text,
  devise              text NOT NULL,
  periode_debut       timestamptz,
  periode_fin         timestamptz,
  nb_commandes        integer NOT NULL DEFAULT 0,
  nb_lignes           integer NOT NULL DEFAULT 0,
  nb_contacts_crees   integer NOT NULL DEFAULT 0,
  nb_rejetees         integer NOT NULL DEFAULT 0,
  total_depense       numeric(12,2) NOT NULL DEFAULT 0,
  total_depense_eur   numeric(12,2) NOT NULL DEFAULT 0,
  statut              text NOT NULL DEFAULT 'importe' CHECK (statut IN ('importe', 'annule')),
  annule_at           timestamptz,
  annulation_rapport  jsonb
);
CREATE INDEX IF NOT EXISTS imports_externes_beatmaker_idx ON imports_externes (beatmaker_id, created_at DESC);

-- ── Commandes importées ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commandes_externes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id           uuid NOT NULL REFERENCES imports_externes(id) ON DELETE CASCADE,
  beatmaker_id        uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  plateforme          text NOT NULL,
  numero_externe      text NOT NULL,
  date_vente          timestamptz NOT NULL,
  acheteur_email      text NOT NULL,
  acheteur_nom        text,
  type_boutique       text,
  reference_paiement  text,
  devise              text NOT NULL,
  taux_change         numeric(14,6) NOT NULL,
  date_taux           date,
  total_catalogue     numeric(12,2) NOT NULL DEFAULT 0,
  total_remise        numeric(12,2) NOT NULL DEFAULT 0,
  total_depense       numeric(12,2) NOT NULL DEFAULT 0,
  total_paye          numeric(12,2) NOT NULL DEFAULT 0,
  total_depense_eur   numeric(12,2) NOT NULL DEFAULT 0,
  UNIQUE (beatmaker_id, plateforme, numero_externe)
);
CREATE INDEX IF NOT EXISTS commandes_externes_client_idx ON commandes_externes (beatmaker_id, client_id);
CREATE INDEX IF NOT EXISTS commandes_externes_import_idx ON commandes_externes (import_id);

CREATE TABLE IF NOT EXISTS commandes_externes_lignes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_externe_id   uuid NOT NULL REFERENCES commandes_externes(id) ON DELETE CASCADE,
  beatmaker_id          uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  ordre                 integer NOT NULL DEFAULT 0,
  titre                 text NOT NULL,
  titre_original        text,
  licence               text,
  prix_catalogue        numeric(12,2) NOT NULL DEFAULT 0,
  remise                numeric(12,2) NOT NULL DEFAULT 0,
  montant_depense       numeric(12,2) NOT NULL DEFAULT 0,
  montant_paye          numeric(12,2) NOT NULL DEFAULT 0,
  montant_depense_eur   numeric(12,2) NOT NULL DEFAULT 0,
  offert                boolean NOT NULL DEFAULT false,
  vendeur_principal     text,
  collaborateurs        text[] NOT NULL DEFAULT '{}',
  beat_id               uuid REFERENCES beats(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS commandes_externes_lignes_commande_idx ON commandes_externes_lignes (commande_externe_id);

CREATE TABLE IF NOT EXISTS imports_externes_contacts (
  import_id     uuid NOT NULL REFERENCES imports_externes(id) ON DELETE CASCADE,
  beatmaker_id  uuid NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_cree   boolean NOT NULL DEFAULT false,
  snapshot      jsonb NOT NULL,
  PRIMARY KEY (import_id, client_id)
);

-- ── RLS : le beatmaker lit ses propres données ; aucune écriture directe ──
ALTER TABLE imports_externes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes_externes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes_externes_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports_externes_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS imports_externes_select_own ON imports_externes;
CREATE POLICY imports_externes_select_own ON imports_externes
  FOR SELECT TO authenticated USING (beatmaker_id = auth.uid());
DROP POLICY IF EXISTS commandes_externes_select_own ON commandes_externes;
CREATE POLICY commandes_externes_select_own ON commandes_externes
  FOR SELECT TO authenticated USING (beatmaker_id = auth.uid());
DROP POLICY IF EXISTS commandes_externes_lignes_select_own ON commandes_externes_lignes;
CREATE POLICY commandes_externes_lignes_select_own ON commandes_externes_lignes
  FOR SELECT TO authenticated USING (beatmaker_id = auth.uid());
DROP POLICY IF EXISTS imports_externes_contacts_select_own ON imports_externes_contacts;
CREATE POLICY imports_externes_contacts_select_own ON imports_externes_contacts
  FOR SELECT TO authenticated USING (beatmaker_id = auth.uid());

GRANT SELECT ON imports_externes, commandes_externes, commandes_externes_lignes, imports_externes_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON imports_externes, commandes_externes, commandes_externes_lignes, imports_externes_contacts TO service_role;

-- ── leads : source « import » + plateforme d'origine ─────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_plateforme text;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('visite', 'newsletter', 'free_download', 'achat', 'manuel', 'import'));

-- ── commandes : anti-doublon des paiements d'abonnement ──────────────────
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
UPDATE commandes SET stripe_invoice_id = external_order_id
WHERE external_order_id IS NOT NULL AND plateforme_source = 'my_producer' AND stripe_invoice_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS commandes_stripe_invoice_id_key ON commandes (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- ── Import (une seule transaction) ───────────────────────────────────────
-- p_import    : { plateforme, nom_fichier, nom_vendeur, devise, periode_debut, periode_fin, nb_rejetees }
-- p_contacts  : [{ email, prenom, nom, premiere_date }]  (emails en minuscule)
-- p_commandes : [{ numero_externe, date_vente, acheteur_email, acheteur_nom, type_boutique,
--                  reference_paiement, devise, taux_change, date_taux, total_catalogue,
--                  total_remise, total_depense, total_paye, total_depense_eur,
--                  lignes: [{ ordre, titre, titre_original, licence, prix_catalogue, remise,
--                             montant_depense, montant_paye, montant_depense_eur, offert,
--                             vendeur_principal, collaborateurs }] }]
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

  -- Contacts : même email (minuscule) = même personne, seul rapprochement
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

  -- Commandes (une commande déjà importée n'est jamais modifiée)
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
    montant_depense, montant_paye, montant_depense_eur, offert, vendeur_principal, collaborateurs
  )
  SELECT n.id, p_beatmaker_id, l.ordre, l.titre, l.titre_original, l.licence, l.prix_catalogue, l.remise,
    l.montant_depense, l.montant_paye, l.montant_depense_eur, coalesce(l.offert, false), l.vendeur_principal,
    coalesce(l.collaborateurs, '{}')
  FROM _cmd c
  JOIN _ins n ON n.numero_externe = c.numero_externe
  CROSS JOIN LATERAL jsonb_to_recordset(c.lignes) AS l(
    ordre integer, titre text, titre_original text, licence text, prix_catalogue numeric, remise numeric,
    montant_depense numeric, montant_paye numeric, montant_depense_eur numeric, offert boolean,
    vendeur_principal text, collaborateurs text[]
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

-- Valeurs d'un contact modifiables à la main (fiche client) : comparées à
-- l'annulation pour savoir si le beatmaker a touché au contact depuis l'import.
CREATE OR REPLACE FUNCTION client_snapshot_import(p_client_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'email', c.email, 'prenom', c.prenom, 'nom', c.nom, 'surnom', c.surnom,
    'nom_artiste', c.nom_artiste, 'telephone', c.telephone, 'langue', c.langue,
    'pays', c.pays, 'notes', c.notes, 'tags', c.tags, 'instagram', c.instagram,
    'spotify', c.spotify, 'youtube', c.youtube, 'tiktok', c.tiktok,
    'emails_secondaires', c.emails_secondaires
  )
  FROM clients c WHERE c.id = p_client_id;
$$;

-- Un client (fiche commune à toute la plateforme) est-il utilisé ailleurs ?
-- Parcourt toutes les tables qui pointent vers clients (sauf le registre des
-- imports) + les comptes de connexion : supprimé seulement s'il n'y a rien.
CREATE OR REPLACE FUNCTION client_reference_ailleurs(p_client_id uuid) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r      record;
  trouve boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_client_id) THEN RETURN true; END IF;
  -- listes_crm_contacts.client_id n'a pas de clé étrangère : vérifié à part
  IF EXISTS (SELECT 1 FROM listes_crm_contacts WHERE client_id = p_client_id) THEN RETURN true; END IF;
  FOR r IN
    SELECT cl.relname AS tbl, a.attname AS col
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.clients'::regclass
      AND ns.nspname = 'public'
      AND cl.relname <> 'imports_externes_contacts'
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1)', r.tbl, r.col)
      INTO trouve USING p_client_id;
    IF trouve THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- ── Annulation d'un import (une seule transaction) ───────────────────────
-- Commandes de l'import supprimées. Contact créé par l'import supprimé
-- seulement s'il n'a rien d'autre dans la boutique ; sa fiche plateforme
-- (clients) seulement si elle a été créée par l'import et n'est utilisée nulle part.
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
                   AND (newsletter_statut <> 'non_inscrit' OR newsletter_statut_at IS NOT NULL OR source <> 'import'))
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

REVOKE ALL ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION annuler_import_externe(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION client_snapshot_import(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION client_reference_ailleurs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION annuler_import_externe(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION client_snapshot_import(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION client_reference_ailleurs(uuid) TO service_role;

COMMIT;
