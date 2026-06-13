-- Ajoute 'manuel' comme source valide pour les contacts ajoutés manuellement via le CRM
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
      AND tc.constraint_schema = cc.constraint_schema
    WHERE tc.table_name   = 'leads'
      AND tc.table_schema = 'public'
      AND tc.constraint_type = 'CHECK'
      AND cc.check_clause LIKE '%source%'
  LOOP
    EXECUTE 'ALTER TABLE leads DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('visite', 'newsletter', 'free_download', 'achat', 'manuel'));
