-- Lot 1 bis. Sauvegarder AVANT les GRANT inverses du relevé T0.
-- Uniquement les tables de public ; service_role et les défauts restent intacts.
BEGIN;
DO $$
DECLARE t record; colonne record; droit record;
BEGIN
  FOR t IN SELECT c.oid, n.nspname, c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM PUBLIC, anon, authenticated', t.nspname, t.relname);
    -- MAINTAIN existe à partir de PostgreSQL 17 : uniquement s'il est réellement accordé.
    FOR droit IN SELECT DISTINCT a.privilege_type FROM pg_class c
      CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid = t.oid AND a.privilege_type = 'MAINTAIN'
        AND (a.grantee = 0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated')))
    LOOP
      EXECUTE format('REVOKE %s ON TABLE %I.%I FROM PUBLIC, anon, authenticated', droit.privilege_type, t.nspname, t.relname);
    END LOOP;
    FOR colonne IN SELECT attname FROM pg_attribute
      WHERE attrelid = t.oid AND attnum > 0 AND NOT attisdropped
    LOOP
      EXECUTE format('REVOKE REFERENCES (%I) ON TABLE %I.%I FROM PUBLIC, anon, authenticated', colonne.attname, t.nspname, t.relname);
    END LOOP;
  END LOOP;
END $$;
COMMIT;
