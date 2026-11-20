-- Rang 9f, Lot 1, T0 (lecture seule) : colonnes texte de la base qui pointent encore vers l'ancien espace myproducer-beats
-- Ne modifie rien. Une ligne par colonne concernée, avec le nombre de lignes. Aucun résultat = plus rien ne pointe vers l'ancien espace.
select * from (
  select c.table_name as table_concernee,
         c.column_name as colonne,
         (xpath('/row/n/text()',
                query_to_xml(format('select count(*) as n from public.%I where %I::text like %L or %I::text like %L',
                                    c.table_name, c.column_name, '%pub-f5c386%', c.column_name, '%myproducer-beats%'),
                             false, true, '')))[1]::text::int as nb_lignes
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and c.data_type in ('text', 'character varying', 'json', 'jsonb', 'ARRAY')
) releve
where nb_lignes > 0
order by nb_lignes desc, table_concernee, colonne;
