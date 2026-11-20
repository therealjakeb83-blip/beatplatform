-- Lecture seule, dans un nouvel onglet APRÈS chaque SQL (lire seulement sa section).
-- SQL 1 : chaque règle de texte/archive vérifie aussi licences.beatmaker_id.
-- SQL 2 : politique propriétaire SELECT, droits d'écriture false y compris colonnes.
-- SQL 3 : INSERT/UPDATE/DELETE exigent active + type hybride ; UPDATE protège l'ancienne ligne aussi.
-- SQL 4 : WITH CHECK exige liste propre + contact lié + absence d'effacement.
SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('licences_textes','licences_textes_historique','beat_splits','categories','listes_crm_contacts')
ORDER BY tablename, policyname;

SELECT r.rolname,
  has_table_privilege(r.oid, 'public.beat_splits', 'INSERT') AS insertion,
  has_table_privilege(r.oid, 'public.beat_splits', 'UPDATE') AS modification,
  has_table_privilege(r.oid, 'public.beat_splits', 'DELETE') AS suppression,
  has_any_column_privilege(r.oid, 'public.beat_splits', 'INSERT') AS insertion_colonne,
  has_any_column_privilege(r.oid, 'public.beat_splits', 'UPDATE') AS modification_colonne
FROM pg_roles r WHERE rolname IN ('anon','authenticated','service_role');

-- SQL 5 : zéro ligne pour anon/authenticated ; service_role reste inchangé.
SELECT r.rolname, c.relname, p.droit FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN pg_roles r
CROSS JOIN (VALUES ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(droit)
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND r.rolname IN ('anon','authenticated')
AND (CASE WHEN p.droit = 'MAINTAIN' AND current_setting('server_version_num')::int < 170000
  THEN false ELSE has_table_privilege(r.oid,c.oid,p.droit) END OR
  (p.droit = 'REFERENCES' AND has_any_column_privilege(r.oid,c.oid,'REFERENCES')))
ORDER BY r.rolname, c.relname, p.droit;
