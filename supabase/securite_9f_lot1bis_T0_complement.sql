-- Lecture seule. Complète Q1 : archives, listes, images et droits techniques.
-- Garder les résultats AVANT d'exécuter les migrations : les inverses sont issus du vrai état.
WITH cibles(lot, nom, policies) AS (VALUES
  (1, 'licences_textes', ARRAY['licences_textes_beatmaker_own']),
  (1, 'licences_textes_historique', ARRAY['licences_textes_historique_beatmaker_own','licences_textes_historique_beatmaker_insert']),
  (2, 'beat_splits', ARRAY['beatmaker gère ses splits']),
  (3, 'categories', ARRAY['categories_insert','categories_update','categories_delete']),
  (4, 'listes_crm_contacts', ARRAY['beatmaker voit ses listes contacts'])
), politiques AS (
  SELECT c.lot, c.nom, cible.nom_policy,
    format('DROP POLICY IF EXISTS %I ON public.%I;', cible.nom_policy, c.nom) AS retirer,
    CASE WHEN p.policyname IS NOT NULL THEN format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;',
      p.policyname, c.nom, p.permissive, p.cmd,
      (SELECT string_agg(CASE WHEN r = 'public' THEN 'PUBLIC' ELSE quote_ident(r) END, ', ') FROM unnest(p.roles) r),
      CASE WHEN p.qual IS NULL THEN '' ELSE ' USING (' || p.qual || ')' END,
      CASE WHEN p.with_check IS NULL THEN '' ELSE ' WITH CHECK (' || p.with_check || ')' END
    ) ELSE '' END AS restaurer
  FROM cibles c CROSS JOIN LATERAL unnest(c.policies) cible(nom_policy)
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.nom AND p.policyname = cible.nom_policy
), droits AS (
  SELECT c.relname, NULL::name AS colonne, a.grantee, a.privilege_type, a.is_grantable
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  UNION ALL
  SELECT c.relname, at.attname, a.grantee, a.privilege_type, a.is_grantable
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute at ON at.attrelid = c.oid AND at.attnum > 0 AND NOT at.attisdropped
    CROSS JOIN LATERAL aclexplode(at.attacl) a
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
), inverses_droits AS (
  SELECT CASE WHEN d.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN') THEN 5 ELSE 2 END AS lot,
    format('GRANT %s%s ON TABLE public.%I TO %s%s;', d.privilege_type,
      CASE WHEN d.colonne IS NULL THEN '' ELSE format(' (%I)', d.colonne) END, d.relname,
      CASE WHEN d.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END,
      CASE WHEN d.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END) AS restaurer
  FROM droits d LEFT JOIN pg_roles r ON r.oid = d.grantee
  WHERE (d.grantee = 0 OR r.rolname IN ('anon','authenticated')) AND (
    d.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN') OR
    (d.relname = 'beat_splits' AND d.privilege_type IN ('INSERT','UPDATE','DELETE'))
  )
), instructions AS (
  SELECT lot, retirer || E'\n' || restaurer AS sql FROM politiques
  UNION ALL SELECT lot, restaurer FROM inverses_droits
)
SELECT jsonb_build_object(
  'inverses', (SELECT jsonb_agg(i ORDER BY lot) FROM (
    SELECT lot, 'BEGIN;' || E'\n' || string_agg(sql, E'\n' ORDER BY sql) || E'\nCOMMIT;' AS sql_inverse_a_conserver
    FROM instructions GROUP BY lot
  ) i),
  'policies', (SELECT jsonb_agg(p ORDER BY tablename, policyname) FROM pg_policies p
    WHERE schemaname = 'public' AND tablename IN (
      'licences_textes','licences_textes_historique','licences','beat_splits','categories',
      'categories_images_boutique','listes_crm','listes_crm_contacts','leads','commandes','abonnements_boutique'
    )),
  'tables', (SELECT jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text))
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')),
  'texte_incoherent', (SELECT count(*) FROM public.licences_textes t
    JOIN public.licences l ON l.id = t.licence_id WHERE t.beatmaker_id <> l.beatmaker_id),
  'historique_incoherent', (SELECT count(*) FROM public.licences_textes_historique t
    JOIN public.licences l ON l.id = t.licence_id WHERE t.beatmaker_id <> l.beatmaker_id)
) AS releve;
