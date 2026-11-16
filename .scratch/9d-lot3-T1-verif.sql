-- 9d lot 3, T1 : lecture seule. Tables liées à clients + contraintes de leads.
SELECT 'fk_vers_clients' AS quoi,
       conrelid::regclass::text || '.' || a.attname AS detail,
       CASE confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'r' THEN 'RESTRICT' WHEN 'a' THEN 'NO ACTION' ELSE confdeltype::text END AS regle
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f' AND c.confrelid = 'public.clients'::regclass
UNION ALL
SELECT 'contrainte_leads', conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'public.leads'::regclass AND contype IN ('u', 'c', 'p')
UNION ALL
SELECT 'index_unique_leads', indexrelid::regclass::text, pg_get_indexdef(indexrelid)
FROM pg_index WHERE indrelid = 'public.leads'::regclass AND indisunique
UNION ALL
SELECT 'colonne_clients_not_null', column_name, coalesce(column_default, '(pas de défaut)')
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clients' AND is_nullable = 'NO'
ORDER BY 1, 2;
