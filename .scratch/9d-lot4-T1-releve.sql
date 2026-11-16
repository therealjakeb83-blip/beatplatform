-- 9d lot 4, T0/T1 : relevé en LECTURE SEULE (ne modifie rien).
-- Un seul tableau : liens vers clients / auth.users, colonnes personnelles, unicité de clients.email.
WITH liens AS (
  SELECT 'lien' AS rubrique,
         c.conrelid::regclass::text AS table_,
         a.attname AS colonne,
         'vers ' || c.confrelid::regclass::text || ' ; suppression = ' ||
         CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'r' THEN 'RESTRICT' WHEN 'a' THEN 'NO ACTION' ELSE c.confdeltype::text END ||
         ' ; vide autorisé = ' || CASE WHEN a.attnotnull THEN 'non' ELSE 'oui' END AS detail
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.contype = 'f' AND c.confrelid IN ('public.clients'::regclass, 'auth.users'::regclass)
),
perso AS (
  SELECT 'colonne' AS rubrique, table_name::text, column_name::text,
         data_type || ' ; vide autorisé = ' || CASE WHEN is_nullable = 'YES' THEN 'oui' ELSE 'non' END
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name NOT IN ('beatmakers', 'beats', 'licences', 'categories', 'abonnements_plateforme')
    AND column_name ~* '(email|telephone|phone|^nom|prenom|nom_|adresse|address|ville|code_postal|pays|country|^ip|_ip|snapshot|destinataire|raison_sociale|tva|langue|surnom|instagram|spotify|youtube|tiktok|notes|tags|metadonnees|corps)'
),
unicite AS (
  SELECT 'index clients' AS rubrique, 'clients', indexname::text, indexdef::text
  FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'clients'
)
SELECT * FROM liens
UNION ALL SELECT * FROM perso
UNION ALL SELECT * FROM unicite
ORDER BY 1, 2, 3;
