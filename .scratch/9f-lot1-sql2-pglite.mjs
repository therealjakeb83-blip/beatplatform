import fs from 'fs'
import { PGlite } from 'file:///C:/Users/nicoj/AppData/Local/Temp/claude/9ddd3c09bf8b3398/3c76a052-57bf-4101-95c2-a12bc74e999b/scratchpad/pg/node_modules/@electric-sql/pglite/dist/index.js'
// 9f lot 1, SQL 2 essayé sur Postgres local : état de départ = relevé T0.
const db = new PGlite()
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222'
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
create table public.beatmakers(id uuid primary key, email text, slug text);
create table public.beats(id uuid primary key default gen_random_uuid(), beatmaker_id uuid, statut text, supprime_le timestamptz, wav_url text);
alter table public.beats enable row level security; alter table public.beatmakers enable row level security;
create policy beatmakers_select_own on public.beatmakers for select using (auth.uid() = id);
create policy beatmakers_select_public on public.beatmakers for select to anon using (true);
create policy beats_select_own on public.beats for select using (auth.uid() = beatmaker_id);
create policy beats_select_public on public.beats for select to anon using (statut='public' and supprime_le is null);
create policy beats_select_prive_meta on public.beats for select to anon using (statut='prive' and supprime_le is null);
create policy beats_select_public_authenticated on public.beats for select to authenticated using (statut in ('public','prive') and supprime_le is null);
grant select on public.beats, public.beatmakers to anon, authenticated, service_role;
insert into public.beatmakers values ('${A}','a@x','a'),('${B}','b@x','b');
insert into public.beats(beatmaker_id, statut, wav_url) values ('${A}','public','w1'),('${A}','prive','w2'),('${B}','public','w3');
`)
async function compter(role, uid) {
  await db.exec(`reset role; set test.uid = '${uid ?? ''}'; set role ${role};`)
  const r = {}
  for (const t of ['beats', 'beatmakers']) { try { r[t] = (await db.query(`select count(*)::int n from public.${t}`)).rows[0].n } catch (e) { r[t] = 'refus' } }
  await db.exec('reset role;')
  return r
}
console.log('AVANT  visiteur', await compter('anon'), '| vendeur A', await compter('authenticated', A))
await db.exec(fs.readFileSync('supabase/securite_9f_lot1_sql2_fermeture_beats_beatmakers.sql', 'utf8'))
await db.exec(fs.readFileSync('supabase/securite_9f_lot1_sql2_fermeture_beats_beatmakers.sql', 'utf8'))
console.log('APRES  visiteur', await compter('anon'), '| vendeur A', await compter('authenticated', A), '| serveur', await compter('service_role'))
const v = await db.query(`select has_table_privilege('anon','public.beats','SELECT') a, has_table_privilege('anon','public.beatmakers','SELECT') b,
 (select string_agg(policyname, ', ' order by policyname) from pg_policies where tablename='beats' and cmd='SELECT') c,
 (select string_agg(policyname, ', ' order by policyname) from pg_policies where tablename='beatmakers' and cmd='SELECT') d`)
console.log('verif', v.rows[0])
const inverse = fs.readFileSync('supabase/securite_9f_lot1_sql2_fermeture_beats_beatmakers.sql', 'utf8').split('Pour défaire')[1].split('\n').filter(l => l.startsWith('-- ') && !l.includes('───')).map(l => l.slice(3)).join('\n')
await db.exec(inverse)
console.log('INVERSE visiteur', await compter('anon'), '| vendeur A', await compter('authenticated', A))
