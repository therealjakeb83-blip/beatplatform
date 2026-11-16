-- Rang 9d, lot 1 — SQL 2 : reconstruction des fiches client PAR boutique.
-- Prérequis : supabase/fiches_clients_lot1_structure.sql exécuté.
--
-- Chaque fiche (leads) ne reçoit QUE ce que la boutique a reçu :
--   - ses commandes : email, nom, adresse, téléphone, pays (dernière adresse) ;
--     beat collab : seul le vendeur principal (commandes.beatmaker_id) a la fiche ;
--   - ses abonnements : email ;
--   - ses ventes importées : email, nom ; si c'est SON import qui a créé le
--     client : aussi les coordonnées du fichier (photo prise à l'import) ;
--   - ajout manuel par cette boutique : ce que le beatmaker a saisi ;
--   - connexion / inscription : l'email du compte seul (décision de Jake, 2026-11-16) ;
--   - notes, tags, surnom, nom d'artiste, réseaux, langue, emails secondaires
--     actuels de la fiche commune : recopiés dans chaque boutique liée
--     (décision 7, données de test ; écrits jusqu'ici par les beatmakers).
-- Fiches manquantes (client lié par une commande / un abonnement / un import,
-- sans ligne leads) : créées, source « achat » (ou « import » si seulement importé).
--
-- RELANÇABLE : ne remplit que les cases vides, ajoute aux listes sans rien
-- retirer, ne touche JAMAIS un champ listé dans champs_manuels, ni la date du
-- 1er contact déjà posée.
--
-- Usage : reconstruire_fiches_boutique(false) = à blanc (compte rendu, rien
-- écrit) ; reconstruire_fiches_boutique(true) = écrit (même compte rendu).

CREATE OR REPLACE FUNCTION reconstruire_fiches_boutique(p_ecrire boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rapport jsonb;
  v_crees   int := 0;
  v_maj     int := 0;
BEGIN
  DROP TABLE IF EXISTS _rf_paires, _rf_cibles, _rf_calc, _rf_final;

  -- Paires client × boutique vues dans les ventes de la boutique
  CREATE TEMP TABLE _rf_paires ON COMMIT DROP AS
  SELECT s.client_id, s.beatmaker_id, min(s.le) AS premier, bool_or(s.nature <> 'import') AS par_vente
  FROM (
    SELECT client_id, beatmaker_id, created_at AS le, 'commande' AS nature
      FROM commandes WHERE client_id IS NOT NULL AND beatmaker_id IS NOT NULL
    UNION ALL
    SELECT client_id, beatmaker_id, created_at, 'abonnement'
      FROM abonnements_boutique WHERE client_id IS NOT NULL AND beatmaker_id IS NOT NULL
    UNION ALL
    SELECT client_id, beatmaker_id, date_vente, 'import' FROM commandes_externes
  ) s
  JOIN clients c ON c.id = s.client_id
  JOIN beatmakers b ON b.id = s.beatmaker_id
  GROUP BY s.client_id, s.beatmaker_id;

  -- Cibles = fiches existantes + fiches à créer
  CREATE TEMP TABLE _rf_cibles ON COMMIT DROP AS
  SELECT l.id AS lead_id, l.client_id, l.beatmaker_id, l.source, l.created_at AS lead_le
    FROM leads l
  UNION ALL
  SELECT NULL::uuid, p.client_id, p.beatmaker_id,
         CASE WHEN p.par_vente THEN 'achat' ELSE 'import' END, p.premier
    FROM _rf_paires p
   WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.client_id = p.client_id AND l.beatmaker_id = p.beatmaker_id);

  -- Valeurs calculées à partir de ce que la boutique a reçu
  CREATE TEMP TABLE _rf_calc ON COMMIT DROP AS
  SELECT
    ci.lead_id, ci.client_id, ci.beatmaker_id, ci.source,
    -- emails : principal actuel en tête, puis les plus récents
    (SELECT coalesce(array_agg(u.e ORDER BY u.principal DESC, u.le DESC NULLS LAST, u.e), '{}')
       FROM (SELECT t.e, bool_or(t.principal) AS principal, max(t.le) AS le
               FROM (
                 SELECT lower(trim(c.email)) AS e, true AS principal, NULL::timestamptz AS le
                 UNION ALL SELECT lower(trim(x)), false, NULL FROM unnest(c.emails_secondaires) x
                 UNION ALL SELECT lower(trim(o.acheteur_email)), false, o.created_at FROM commandes o
                            WHERE o.client_id = ci.client_id AND o.beatmaker_id = ci.beatmaker_id
                 UNION ALL SELECT lower(trim(a.acheteur_email)), false, a.created_at FROM abonnements_boutique a
                            WHERE a.client_id = ci.client_id AND a.beatmaker_id = ci.beatmaker_id
                 UNION ALL SELECT lower(trim(x.acheteur_email)), false, x.date_vente FROM commandes_externes x
                            WHERE x.client_id = ci.client_id AND x.beatmaker_id = ci.beatmaker_id
               ) t
              WHERE coalesce(t.e, '') <> ''
              GROUP BY t.e) u) AS emails,
    -- téléphones : saisis à l'achat dans cette boutique (+ ajout manuel, + son import créateur)
    (SELECT coalesce(array_agg(u.t ORDER BY u.le DESC NULLS LAST, u.t), '{}')
       FROM (SELECT t.t, max(t.le) AS le
               FROM (
                 SELECT trim(o.acheteur_telephone) AS t, o.created_at AS le FROM commandes o
                  WHERE o.client_id = ci.client_id AND o.beatmaker_id = ci.beatmaker_id
                 UNION ALL SELECT trim(c.telephone), NULL WHERE ci.source = 'manuel'
                 UNION ALL SELECT trim(imp.snapshot ->> 'telephone'), NULL WHERE imp.snapshot IS NOT NULL
               ) t
              WHERE coalesce(t.t, '') <> ''
              GROUP BY t.t) u) AS telephones,
    -- adresses : celles des commandes de cette boutique (+ son import créateur)
    (SELECT coalesce(jsonb_agg(d.obj ORDER BY d.le DESC NULLS LAST), '[]'::jsonb)
       FROM (SELECT DISTINCT ON (a.obj ->> 'ligne') a.obj, a.le
               FROM (
                 SELECT jsonb_strip_nulls(jsonb_build_object(
                          'ligne', trim(o.acheteur_adresse),
                          'pays',  substring(trim(o.acheteur_adresse) FROM '(?:^|, )([A-Z]{2})$'))) AS obj,
                        o.created_at AS le
                   FROM commandes o
                  WHERE o.client_id = ci.client_id AND o.beatmaker_id = ci.beatmaker_id
                    AND coalesce(trim(o.acheteur_adresse), '') <> ''
                 UNION ALL
                 SELECT jsonb_strip_nulls(jsonb_build_object(
                          'ligne', concat_ws(', ', nullif(trim(c.adresse), ''),
                                             nullif(trim(concat_ws(' ', nullif(trim(c.code_postal), ''), nullif(trim(c.ville), ''))), ''),
                                             nullif(trim(c.pays), '')),
                          'adresse', nullif(trim(c.adresse), ''), 'code_postal', nullif(trim(c.code_postal), ''),
                          'ville', nullif(trim(c.ville), ''), 'pays', nullif(trim(c.pays), ''))), NULL
                  WHERE imp.snapshot IS NOT NULL
                    AND (coalesce(trim(c.adresse), '') <> '' OR coalesce(trim(c.ville), '') <> '')
               ) a
              ORDER BY a.obj ->> 'ligne', a.le DESC NULLS LAST) d) AS adresses,
    -- remplis une fois : ajout manuel > import créateur > 1er nom saisi à un achat
    coalesce(CASE WHEN ci.source = 'manuel' THEN nullif(trim(c.prenom), '') END,
             nullif(trim(imp.snapshot ->> 'prenom'), ''),
             nullif(split_part(nv.n, ' ', 1), '')) AS prenom,
    coalesce(CASE WHEN ci.source = 'manuel' THEN nullif(trim(c.nom), '') END,
             nullif(trim(imp.snapshot ->> 'nom'), ''),
             CASE WHEN strpos(nv.n, ' ') > 0 THEN nullif(trim(substr(nv.n, strpos(nv.n, ' ') + 1)), '') END) AS nom,
    nullif(trim(c.nom_artiste), '') AS nom_artiste,
    -- dernière valeur : pays de la dernière adresse d'achat, sinon import créateur, sinon ajout manuel
    coalesce((SELECT substring(trim(o.acheteur_adresse) FROM '(?:^|, )([A-Z]{2})$')
                FROM commandes o
               WHERE o.client_id = ci.client_id AND o.beatmaker_id = ci.beatmaker_id
                 AND substring(trim(o.acheteur_adresse) FROM '(?:^|, )([A-Z]{2})$') IS NOT NULL
               ORDER BY o.created_at DESC LIMIT 1),
             nullif(trim(imp.snapshot ->> 'pays'), ''),
             CASE WHEN ci.source = 'manuel' THEN nullif(trim(c.pays), '') END) AS pays,
    nullif(trim(c.langue), '') AS langue,
    -- figé : date du 1er contact
    LEAST(ci.lead_le, p.premier) AS premier_contact_le,
    -- beatmaker seul (recopiés, décision 7)
    nullif(c.notes, '') AS notes,
    coalesce(c.tags, '{}') AS tags,
    nullif(trim(c.surnom), '') AS surnom,
    nullif(trim(c.instagram), '') AS instagram,
    nullif(trim(c.spotify), '') AS spotify,
    nullif(trim(c.youtube), '') AS youtube,
    nullif(trim(c.tiktok), '') AS tiktok
  FROM _rf_cibles ci
  JOIN clients c ON c.id = ci.client_id
  LEFT JOIN _rf_paires p ON p.client_id = ci.client_id AND p.beatmaker_id = ci.beatmaker_id
  LEFT JOIN LATERAL (
    SELECT ic.snapshot FROM imports_externes_contacts ic
     WHERE ic.client_id = ci.client_id AND ic.beatmaker_id = ci.beatmaker_id AND ic.client_cree
     LIMIT 1
  ) imp ON true
  LEFT JOIN LATERAL (
    SELECT regexp_replace(trim(v.n), '\s+', ' ', 'g') AS n
      FROM (
        SELECT o.acheteur_nom AS n, o.created_at AS le FROM commandes o
         WHERE o.client_id = ci.client_id AND o.beatmaker_id = ci.beatmaker_id
        UNION ALL
        SELECT x.acheteur_nom, x.date_vente FROM commandes_externes x
         WHERE x.client_id = ci.client_id AND x.beatmaker_id = ci.beatmaker_id
      ) v
     WHERE coalesce(trim(v.n), '') <> ''
     ORDER BY v.le ASC LIMIT 1
  ) nv ON true;

  -- Fusion avec la fiche existante : cases vides seulement, listes complétées,
  -- jamais un champ marqué « modifié à la main »
  CREATE TEMP TABLE _rf_final ON COMMIT DROP AS
  SELECT
    k.lead_id, k.client_id, k.beatmaker_id, k.source,
    CASE WHEN 'emails' = ANY(m.manu) THEN l.emails
         ELSE coalesce(l.emails, '{}') || ARRAY(SELECT x FROM unnest(k.emails) WITH ORDINALITY u(x, i)
                                                WHERE NOT x = ANY(coalesce(l.emails, '{}')) ORDER BY i) END AS emails,
    CASE WHEN 'telephones' = ANY(m.manu) THEN l.telephones
         ELSE coalesce(l.telephones, '{}') || ARRAY(SELECT x FROM unnest(k.telephones) WITH ORDINALITY u(x, i)
                                                    WHERE NOT x = ANY(coalesce(l.telephones, '{}')) ORDER BY i) END AS telephones,
    CASE WHEN 'adresses' = ANY(m.manu) THEN l.adresses
         ELSE coalesce(l.adresses, '[]'::jsonb) || coalesce((
                SELECT jsonb_agg(a ORDER BY i) FROM jsonb_array_elements(k.adresses) WITH ORDINALITY u(a, i)
                 WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(l.adresses, '[]'::jsonb)) e
                                    WHERE e ->> 'ligne' = a ->> 'ligne')), '[]'::jsonb) END AS adresses,
    CASE WHEN 'prenom'      = ANY(m.manu) OR coalesce(l.prenom, '')      <> '' THEN l.prenom      ELSE k.prenom      END AS prenom,
    CASE WHEN 'nom'         = ANY(m.manu) OR coalesce(l.nom, '')         <> '' THEN l.nom         ELSE k.nom         END AS nom,
    CASE WHEN 'nom_artiste' = ANY(m.manu) OR coalesce(l.nom_artiste, '') <> '' THEN l.nom_artiste ELSE k.nom_artiste END AS nom_artiste,
    CASE WHEN 'pays'        = ANY(m.manu) OR coalesce(l.pays, '')        <> '' THEN l.pays        ELSE k.pays        END AS pays,
    CASE WHEN 'langue'      = ANY(m.manu) OR coalesce(l.langue, '')      <> '' THEN l.langue      ELSE k.langue      END AS langue,
    coalesce(l.premier_contact_le, k.premier_contact_le) AS premier_contact_le,
    CASE WHEN 'notes'       = ANY(m.manu) OR coalesce(l.notes, '')       <> '' THEN l.notes       ELSE k.notes       END AS notes,
    CASE WHEN 'tags' = ANY(m.manu) THEN l.tags
         ELSE coalesce(l.tags, '{}') || ARRAY(SELECT x FROM unnest(k.tags) WITH ORDINALITY u(x, i)
                                              WHERE NOT x = ANY(coalesce(l.tags, '{}')) ORDER BY i) END AS tags,
    CASE WHEN 'surnom'      = ANY(m.manu) OR coalesce(l.surnom, '')      <> '' THEN l.surnom      ELSE k.surnom      END AS surnom,
    CASE WHEN 'instagram'   = ANY(m.manu) OR coalesce(l.instagram, '')   <> '' THEN l.instagram   ELSE k.instagram   END AS instagram,
    CASE WHEN 'spotify'     = ANY(m.manu) OR coalesce(l.spotify, '')     <> '' THEN l.spotify     ELSE k.spotify     END AS spotify,
    CASE WHEN 'youtube'     = ANY(m.manu) OR coalesce(l.youtube, '')     <> '' THEN l.youtube     ELSE k.youtube     END AS youtube,
    CASE WHEN 'tiktok'      = ANY(m.manu) OR coalesce(l.tiktok, '')      <> '' THEN l.tiktok      ELSE k.tiktok      END AS tiktok,
    -- ligne qui change réellement ?
    (l.id IS NULL) AS a_creer
  FROM _rf_calc k
  LEFT JOIN leads l ON l.id = k.lead_id
  CROSS JOIN LATERAL (SELECT coalesce(l.champs_manuels, '{}') AS manu) m;

  -- Compte rendu
  SELECT jsonb_build_object(
    'mode', CASE WHEN p_ecrire THEN 'ÉCRIT' ELSE 'À BLANC (rien écrit)' END,
    'fiches_existantes', (SELECT count(*) FROM leads),
    'fiches_a_creer', (SELECT count(*) FROM _rf_final WHERE a_creer),
    'fiches_a_creer_par_source', (SELECT coalesce(jsonb_object_agg(source, n), '{}') FROM
                                   (SELECT source, count(*) n FROM _rf_final WHERE a_creer GROUP BY source) s),
    'fiches_qui_changent', (SELECT count(*) FROM _rf_final f JOIN leads l ON l.id = f.lead_id
                             WHERE (f.emails, f.telephones, f.adresses, f.prenom, f.nom, f.nom_artiste, f.pays, f.langue,
                                    f.premier_contact_le, f.notes, f.tags, f.surnom, f.instagram, f.spotify, f.youtube, f.tiktok)
                                   IS DISTINCT FROM
                                   (l.emails, l.telephones, l.adresses, l.prenom, l.nom, l.nom_artiste, l.pays, l.langue,
                                    l.premier_contact_le, l.notes, l.tags, l.surnom, l.instagram, l.spotify, l.youtube, l.tiktok)),
    'champs_remplis_sur_les_fiches', (SELECT jsonb_build_object(
        'emails',      count(*) FILTER (WHERE cardinality(f.emails) > 0),
        'emails_2_ou_plus', count(*) FILTER (WHERE cardinality(f.emails) > 1),
        'telephones',  count(*) FILTER (WHERE cardinality(f.telephones) > 0),
        'adresses',    count(*) FILTER (WHERE jsonb_array_length(f.adresses) > 0),
        'prenom',      count(*) FILTER (WHERE f.prenom IS NOT NULL),
        'nom',         count(*) FILTER (WHERE f.nom IS NOT NULL),
        'nom_artiste', count(*) FILTER (WHERE f.nom_artiste IS NOT NULL),
        'pays',        count(*) FILTER (WHERE f.pays IS NOT NULL),
        'langue',      count(*) FILTER (WHERE f.langue IS NOT NULL),
        'premier_contact_le', count(*) FILTER (WHERE f.premier_contact_le IS NOT NULL),
        'notes',       count(*) FILTER (WHERE f.notes IS NOT NULL),
        'tags',        count(*) FILTER (WHERE cardinality(f.tags) > 0),
        'surnom',      count(*) FILTER (WHERE f.surnom IS NOT NULL),
        'reseaux',     count(*) FILTER (WHERE coalesce(f.instagram, f.spotify, f.youtube, f.tiktok) IS NOT NULL),
        'sans_aucun_email', count(*) FILTER (WHERE cardinality(f.emails) = 0)
      ) FROM _rf_final f),
    'fiches_total_apres', (SELECT count(*) FROM _rf_final)
  ) INTO v_rapport;

  IF p_ecrire THEN
    INSERT INTO leads (client_id, beatmaker_id, source, created_at, emails, telephones, adresses, prenom, nom,
                       nom_artiste, pays, langue, premier_contact_le, notes, tags, surnom, instagram, spotify,
                       youtube, tiktok, reconstruite_le)
    SELECT f.client_id, f.beatmaker_id, f.source, coalesce(f.premier_contact_le, now()), f.emails, f.telephones,
           f.adresses, f.prenom, f.nom, f.nom_artiste, f.pays, f.langue, f.premier_contact_le, f.notes, f.tags,
           f.surnom, f.instagram, f.spotify, f.youtube, f.tiktok, now()
      FROM _rf_final f WHERE f.a_creer
    ON CONFLICT (client_id, beatmaker_id) DO NOTHING;
    GET DIAGNOSTICS v_crees = ROW_COUNT;

    UPDATE leads l SET
      emails = f.emails, telephones = f.telephones, adresses = f.adresses, prenom = f.prenom, nom = f.nom,
      nom_artiste = f.nom_artiste, pays = f.pays, langue = f.langue, premier_contact_le = f.premier_contact_le,
      notes = f.notes, tags = f.tags, surnom = f.surnom, instagram = f.instagram, spotify = f.spotify,
      youtube = f.youtube, tiktok = f.tiktok, reconstruite_le = now()
    FROM _rf_final f
    WHERE l.id = f.lead_id
      AND (f.emails, f.telephones, f.adresses, f.prenom, f.nom, f.nom_artiste, f.pays, f.langue,
           f.premier_contact_le, f.notes, f.tags, f.surnom, f.instagram, f.spotify, f.youtube, f.tiktok)
          IS DISTINCT FROM
          (l.emails, l.telephones, l.adresses, l.prenom, l.nom, l.nom_artiste, l.pays, l.langue,
           l.premier_contact_le, l.notes, l.tags, l.surnom, l.instagram, l.spotify, l.youtube, l.tiktok);
    GET DIAGNOSTICS v_maj = ROW_COUNT;

    v_rapport := v_rapport || jsonb_build_object('fiches_creees', v_crees, 'fiches_modifiees', v_maj);
  END IF;

  RETURN v_rapport;
END;
$$;

REVOKE ALL ON FUNCTION reconstruire_fiches_boutique(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reconstruire_fiches_boutique(boolean) TO service_role;

-- Passe À BLANC : compte rendu, rien n'est écrit.
SELECT reconstruire_fiches_boutique(false) AS compte_rendu;
