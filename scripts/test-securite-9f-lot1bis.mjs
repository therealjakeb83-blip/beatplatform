import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const chemin = process.argv[2]
const { PGlite } = chemin ? await import(pathToFileURL(chemin).href) : await import('@electric-sql/pglite')
const db = new PGlite()
const version = Number((await db.query("SELECT current_setting('server_version_num') n")).rows[0].n)
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'
const D = '44444444-4444-4444-4444-444444444444'
const lire = nom => fs.readFileSync(`supabase/${nom}.sql`, 'utf8')
const appliquer = n => db.exec(lire(`securite_9f_lot1bis_sql${n}_${['','contrats','collaborations','categories','listes','droits_techniques'][n]}`))
let essais = 0
async function comme(role, uid, sql) {
  await db.exec(`RESET ROLE; SET test.uid = '${uid ?? ''}'; SET ROLE ${role}`)
  try { return await db.query(sql) } finally { await db.exec('RESET ROLE') }
}
async function refuse(uid, sql, role = 'authenticated') {
  await assert.rejects(comme(role, uid, sql), e => ['42501'].includes(e.code))
  essais++
}
async function compte(uid, table, n, role = 'authenticated') {
  assert.equal((await comme(role, uid, `SELECT count(*)::int n FROM ${table}`)).rows[0].n, n)
  essais++
}
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid', true),'')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE TABLE licences(id uuid PRIMARY KEY, beatmaker_id uuid);
CREATE TABLE licences_textes(id uuid DEFAULT gen_random_uuid(), licence_id uuid UNIQUE REFERENCES licences, beatmaker_id uuid, contenu text);
CREATE TABLE licences_textes_historique(licence_id uuid REFERENCES licences, beatmaker_id uuid, contenu text);
CREATE TABLE beats(id uuid PRIMARY KEY, beatmaker_id uuid);
CREATE TABLE beat_splits(id uuid DEFAULT gen_random_uuid(), beat_id uuid REFERENCES beats, beatmaker_id uuid, statut text, preuve text);
CREATE TABLE categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), beatmaker_id uuid, source text, statut text DEFAULT 'active', type text, nom text);
CREATE TABLE listes_crm(id uuid PRIMARY KEY, beatmaker_id uuid);
CREATE TABLE listes_crm_contacts(liste_id uuid REFERENCES listes_crm, client_id uuid, PRIMARY KEY(liste_id,client_id));
CREATE TABLE leads(client_id uuid, beatmaker_id uuid, efface_le timestamptz);
CREATE TABLE commandes(client_id uuid, beatmaker_id uuid);
CREATE TABLE abonnements_boutique(client_id uuid, beatmaker_id uuid);
ALTER TABLE licences ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON licences USING (beatmaker_id=auth.uid());
ALTER TABLE beats ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON beats USING (beatmaker_id=auth.uid());
ALTER TABLE listes_crm ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON listes_crm USING (beatmaker_id=auth.uid());
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON leads USING (beatmaker_id=auth.uid());
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON commandes USING (beatmaker_id=auth.uid());
ALTER TABLE abonnements_boutique ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON abonnements_boutique USING (beatmaker_id=auth.uid());
ALTER TABLE licences_textes ENABLE ROW LEVEL SECURITY;
CREATE POLICY licences_textes_beatmaker_own ON licences_textes FOR ALL USING (beatmaker_id=auth.uid());
ALTER TABLE licences_textes_historique ENABLE ROW LEVEL SECURITY;
CREATE POLICY licences_textes_historique_beatmaker_own ON licences_textes_historique FOR SELECT USING (beatmaker_id=auth.uid());
CREATE POLICY licences_textes_historique_beatmaker_insert ON licences_textes_historique FOR INSERT WITH CHECK (beatmaker_id=auth.uid());
ALTER TABLE beat_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beatmaker gère ses splits" ON beat_splits FOR ALL USING (EXISTS (SELECT 1 FROM beats WHERE id=beat_id AND beatmaker_id=auth.uid()));
CREATE POLICY "collab voit ses splits" ON beat_splits FOR SELECT USING (beatmaker_id=auth.uid());
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_select ON categories FOR SELECT USING (source='plateforme' OR statut='certifiee' OR beatmaker_id=auth.uid());
CREATE POLICY categories_insert ON categories FOR INSERT WITH CHECK (beatmaker_id=auth.uid() AND source='beatmaker');
CREATE POLICY categories_update ON categories FOR UPDATE USING (beatmaker_id=auth.uid() AND source='beatmaker') WITH CHECK (beatmaker_id=auth.uid() AND source='beatmaker' AND statut IN ('active','en_attente_certification'));
CREATE POLICY categories_delete ON categories FOR DELETE USING (beatmaker_id=auth.uid() AND source='beatmaker' AND statut='active');
ALTER TABLE listes_crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beatmaker voit ses listes contacts" ON listes_crm_contacts FOR ALL USING (EXISTS (SELECT 1 FROM listes_crm WHERE id=liste_id AND beatmaker_id=auth.uid()));
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT UPDATE (statut), INSERT (beat_id,beatmaker_id) ON beat_splits TO PUBLIC;
GRANT REFERENCES (id) ON licences TO PUBLIC;
INSERT INTO licences VALUES ('${A}','${A}'),('${B}','${B}');
INSERT INTO beats VALUES ('${A}','${A}'),('${B}','${B}');
INSERT INTO listes_crm VALUES ('${A}','${A}'),('${B}','${B}');
INSERT INTO leads VALUES ('${A}','${A}',NULL),('${B}','${B}',NULL),('${C}','${A}',now());
INSERT INTO commandes VALUES ('${C}','${A}'),('${D}','${A}');
`)
// Politiques relevées par Jake le 20/11 ; aucune donnée de production.
await db.exec(fs.readFileSync(process.argv[3] ?? 'scripts/fixtures/securite-9f-lot1bis-policies.sql', 'utf8'))
try {
  // Prouver les contournements sur le modèle initial, sans réseau ni vraie donnée.
  await comme('authenticated', A, `INSERT INTO licences_textes(licence_id,beatmaker_id,contenu) VALUES ('${B}','${A}','intrus')`)
  await comme('authenticated', A, `INSERT INTO beat_splits(beat_id,beatmaker_id,statut,preuve) VALUES ('${A}','${B}','active','fabriquee')`)
  await comme('authenticated', A, `INSERT INTO categories(beatmaker_id,source,statut,type,nom) VALUES ('${A}','beatmaker','certifiee','styles','intrus')`)
  await comme('authenticated', A, `INSERT INTO listes_crm_contacts VALUES ('${A}','${B}')`)
  console.log('AVANT : quatre contournements reproduits localement')
  await assert.rejects(appliquer(1), /S10/)
  await db.exec('ROLLBACK; DELETE FROM licences_textes; DELETE FROM beat_splits; DELETE FROM categories; DELETE FROM listes_crm_contacts;')

  // Les inverses sont générés par le vrai relevé, pas recopiés à la main.
  const releve = await db.exec(lire('securite_9f_lot1bis_T0_complement'))
  const inverses = releve[0].rows[0].releve.inverses
  for (let n = 1; n <= 5; n++) { await appliquer(n); await appliquer(n) }
  await refuse(A, `INSERT INTO licences_textes(licence_id,beatmaker_id,contenu) VALUES ('${B}','${A}','intrus')`)
  await refuse(A, `INSERT INTO licences_textes_historique VALUES ('${B}','${A}','intrus')`)
  await comme('authenticated', A, `INSERT INTO licences_textes(licence_id,beatmaker_id,contenu) VALUES ('${A}','${A}','v1')`)
  await comme('authenticated', A, `INSERT INTO licences_textes_historique VALUES ('${A}','${A}','v1')`)
  await refuse(A, `UPDATE licences_textes SET licence_id='${B}' WHERE licence_id='${A}'`)
  await compte(B, 'licences_textes', 0)
  await compte(A, 'licences_textes', 1)
  await compte(A, 'licences_textes_historique', 1)
  await refuse(null, `INSERT INTO licences_textes(licence_id,beatmaker_id,contenu) VALUES ('${B}','${B}','intrus')`, 'anon')
  await refuse(A, `INSERT INTO beat_splits(beat_id,beatmaker_id,statut) VALUES ('${A}','${B}','active')`)
  await refuse(A, `UPDATE beat_splits SET statut='active'`)
  await refuse(A, 'DELETE FROM beat_splits')
  await comme('service_role', null, `INSERT INTO beat_splits(beat_id,beatmaker_id,statut) VALUES ('${A}','${B}','invitee')`)
  await compte(A, 'beat_splits', 1)
  await compte(B, 'beat_splits', 1)
  await compte(C, 'beat_splits', 0)
  await comme('service_role', null, "UPDATE beat_splits SET statut='active'")
  await refuse(A, `INSERT INTO categories(beatmaker_id,source,statut,type,nom) VALUES ('${A}','beatmaker','certifiee','styles','intrus')`)
  await refuse(A, `INSERT INTO categories(beatmaker_id,source,type,nom) VALUES ('${A}','beatmaker','ambiances','intrus')`)
  await comme('authenticated', A, `INSERT INTO categories(id,beatmaker_id,source,type,nom) VALUES ('${A}','${A}','beatmaker','styles','perso')`)
  await comme('authenticated', A, "UPDATE categories SET nom='perso2'")
  await refuse(A, "UPDATE categories SET statut='certifiee'")
  await comme('service_role', null, "UPDATE categories SET statut='certifiee'")
  await comme('authenticated', A, "UPDATE categories SET statut='active'")
  await comme('authenticated', A, 'DELETE FROM categories')
  assert.equal((await db.query('SELECT statut FROM categories')).rows[0].statut, 'certifiee'); essais++
  await compte(B, 'categories', 1)
  await refuse(A, `INSERT INTO listes_crm_contacts VALUES ('${A}','${B}')`)
  await refuse(A, `INSERT INTO listes_crm_contacts VALUES ('${A}','${C}')`)
  await refuse(A, `INSERT INTO listes_crm_contacts VALUES ('${B}','${A}')`)
  await comme('authenticated', A, `INSERT INTO listes_crm_contacts VALUES ('${A}','${A}'),('${A}','${D}')`)
  await refuse(A, `UPDATE listes_crm_contacts SET client_id='${B}' WHERE client_id='${A}'`)
  await db.exec(`UPDATE leads SET efface_le=now() WHERE client_id='${A}'`)
  await comme('authenticated', A, `DELETE FROM listes_crm_contacts WHERE client_id='${A}'`)
  await compte(A, 'listes_crm_contacts', 1)
  await refuse(A, 'TRUNCATE licences')
  await refuse(null, `CREATE TABLE interdit(x uuid REFERENCES public.licences(id))`, 'anon')
  const verif = await db.exec(lire('securite_9f_lot1bis_verification'))
  assert.equal(verif.at(-1).rows.length, 0); essais++
  for (const r of verif[1].rows.filter(r => r.rolname !== 'service_role')) {
    assert.equal(Object.entries(r).filter(([k]) => k !== 'rolname').some(([, v]) => v), false); essais++
  }
  assert.equal((await db.query("SELECT has_table_privilege('service_role','licences','TRUNCATE') ok")).rows[0].ok, true); essais++
  if (version >= 170000) {
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','licences','MAINTAIN') ok")).rows[0].ok, false)
    assert.equal((await db.query("SELECT has_table_privilege('service_role','licences','MAINTAIN') ok")).rows[0].ok, true)
    essais++
  }
  // Chaque inverse réellement produit est exécutable et restaure la règle précédente.
  for (const r of [...inverses].reverse()) await db.exec(r.sql_inverse_a_conserver)
  await comme('authenticated', A, `INSERT INTO licences_textes(licence_id,beatmaker_id,contenu) VALUES ('${B}','${A}','intrus')`)
  await comme('authenticated', A, `UPDATE beat_splits SET statut='quittee'`)
  await comme('authenticated', A, `INSERT INTO categories(beatmaker_id,source,statut,type,nom) VALUES ('${A}','beatmaker','certifiee','styles','intrus')`)
  await comme('authenticated', A, `INSERT INTO listes_crm_contacts VALUES ('${A}','${B}')`)
  assert.equal((await db.query("SELECT has_table_privilege('authenticated','licences','TRUNCATE') ok")).rows[0].ok, true); essais++
  if (version >= 170000) {
    assert.equal((await db.query("SELECT has_table_privilege('authenticated','licences','MAINTAIN') ok")).rows[0].ok, true); essais++
  }
  console.log(`APRES : PostgreSQL ${version}, ${essais} contrôles OK ; migrations répétables ; cinq inverses exécutés et contournements restaurés sur données fictives`)
} finally { await db.close() }
