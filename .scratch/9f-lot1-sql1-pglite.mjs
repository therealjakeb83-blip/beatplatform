import fs from 'fs'
import { PGlite } from 'file:///C:/Users/nicoj/AppData/Local/Temp/claude/9ddd3c09bf8b3398/3c76a052-57bf-4101-95c2-a12bc74e999b/scratchpad/pg/node_modules/@electric-sql/pglite/dist/index.js'
// 9f lot 1, SQL 1 essayé sur Postgres local (fausses données).
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create table public.licence_downloads(id uuid primary key default gen_random_uuid(), commande_id uuid, beatmaker_id uuid, fichier text, ip_address text, downloaded_at timestamptz default now());
alter table public.licence_downloads enable row level security;
create policy licence_downloads_beatmaker_own on public.licence_downloads for all using (auth.uid() = beatmaker_id);
grant select, insert, truncate on public.licence_downloads to authenticated;
grant select, insert on public.licence_downloads to service_role;
grant usage on schema public to anon, authenticated, service_role;
`)
await db.exec(fs.readFileSync('supabase/securite_9f_lot1_sql1_journal_essais.sql', 'utf8'))
await db.exec(fs.readFileSync('supabase/securite_9f_lot1_sql1_journal_essais.sql', 'utf8')) // rejouable
const verif = await db.query(`select
  (select count(*) from information_schema.tables where table_name = 'essais_acces_commande') as table_essais,
  (select count(*) from information_schema.columns where table_name = 'licence_downloads' and column_name = 'origine') as colonne_origine,
  has_table_privilege('authenticated', 'public.licence_downloads', 'INSERT') as connecte_peut_ecrire,
  (select string_agg(policyname || ':' || cmd, ', ') from pg_policies where tablename = 'licence_downloads') as politiques,
  has_function_privilege('anon', 'public.noter_essai_acces_commande(uuid)', 'EXECUTE') as visiteur_peut_appeler`)
console.log('verif', verif.rows[0])
// Vendeur connecté qui tente d'écrire
await db.exec(`set test.uid = '11111111-1111-1111-1111-111111111111'; set role authenticated;`)
try { await db.exec(`insert into public.licence_downloads(commande_id, beatmaker_id, fichier) values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111','WAV')`); console.log('ECHEC: insert accepte') } catch (e) { console.log('insert connecte refuse:', e.message) }
await db.exec(`reset role;`)
await db.exec(`set role service_role;`)
await db.exec(`insert into public.licence_downloads(commande_id, beatmaker_id, fichier, origine) values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111','WAV','appareil_paiement')`)
console.log('insert service_role OK')
try { await db.exec(`insert into public.licence_downloads(commande_id, fichier, origine) values (gen_random_uuid(),'WAV','nimporte')`); console.log('ECHEC check') } catch (e) { console.log('origine invalide refusee') }
const c = '22222222-2222-2222-2222-222222222222'
for (let i = 1; i <= 6; i++) { const r = await db.query(`select public.noter_essai_acces_commande($1) as b`, [c]); console.log('essai', i, r.rows[0].b ? 'BLOQUE' : 'libre') }
await db.exec(`reset role; update essais_acces_commande set bloque_jusqu = now() - interval '1 minute';`)
const r = await db.query(`select public.noter_essai_acces_commande($1) as b`, [c]); console.log('apres 1h, essai:', r.rows[0].b ? 'BLOQUE' : 'libre', (await db.query('select essais from essais_acces_commande')).rows[0])
