import fs from 'fs'
import { PGlite } from 'file:///C:/Users/nicoj/AppData/Local/Temp/claude/9ddd3c09bf8b3398/3c76a052-57bf-4101-95c2-a12bc74e999b/scratchpad/pg/node_modules/@electric-sql/pglite/dist/index.js'
const db = new PGlite()
let ok = 0, ko = 0
const t = async (nom, f) => { try { const r = await f(); if (r) { ok++; console.log('OK ', nom) } else { ko++; console.log('KO ', nom) } } catch (e) { ko++; console.log('KO ', nom, e.message) } }
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE clients (id uuid PRIMARY KEY, email text);
GRANT ALL ON clients TO service_role;
INSERT INTO clients VALUES ('11111111-1111-1111-1111-111111111111','a@x.fr');`)
await db.exec(fs.readFileSync('supabase/preremplissage_infos_paiement_compte.sql', 'utf8'))
await t('table creee vide', async () => (await db.query('SELECT count(*)::int n FROM infos_paiement_compte')).rows[0].n === 0)
await t('rls active', async () => (await db.query(`SELECT relrowsecurity r FROM pg_class WHERE relname='infos_paiement_compte'`)).rows[0].r === true)
await t('droits anon/auth fermes, service ouvert', async () => {
  const r = (await db.query(`SELECT has_table_privilege('anon','infos_paiement_compte','SELECT') a, has_table_privilege('authenticated','infos_paiement_compte','SELECT') b, has_table_privilege('authenticated','infos_paiement_compte','INSERT') c, has_table_privilege('service_role','infos_paiement_compte','DELETE') d`)).rows[0]
  return !r.a && !r.b && !r.c && r.d
})
await t('authenticated ne peut pas lire', async () => {
  await db.exec('SET ROLE authenticated')
  try { await db.query('SELECT * FROM infos_paiement_compte'); return false } catch { return true } finally { await db.exec('RESET ROLE') }
})
await t('service_role ecrit (upsert)', async () => {
  await db.exec('SET ROLE service_role')
  try {
    await db.query(`INSERT INTO infos_paiement_compte (client_id, prenom, pays, texte_consentement) VALUES ('11111111-1111-1111-1111-111111111111','Lea','FR','x')
      ON CONFLICT (client_id) DO UPDATE SET prenom = excluded.prenom, maj_le = now()`)
    await db.query(`INSERT INTO infos_paiement_compte (client_id, prenom, pays, texte_consentement) VALUES ('11111111-1111-1111-1111-111111111111','Lea2','BE','x')
      ON CONFLICT (client_id) DO UPDATE SET prenom = excluded.prenom, pays = excluded.pays, maj_le = now()`)
    const r = (await db.query('SELECT count(*)::int n, max(prenom) p FROM infos_paiement_compte')).rows[0]
    return r.n === 1 && r.p === 'Lea2'
  } finally { await db.exec('RESET ROLE') }
})
await t('pays invalide refuse', async () => {
  try { await db.query(`UPDATE infos_paiement_compte SET pays='fr'`); return false } catch { return true }
})
await t('client inexistant refuse', async () => {
  try { await db.query(`INSERT INTO infos_paiement_compte (client_id, texte_consentement) VALUES ('22222222-2222-2222-2222-222222222222','x')`); return false } catch { return true }
})
await t('effacement', async () => { await db.query('DELETE FROM infos_paiement_compte WHERE client_id = $1', ['11111111-1111-1111-1111-111111111111']); return (await db.query('SELECT count(*)::int n FROM infos_paiement_compte')).rows[0].n === 0 })
await t('SQL rejouable', async () => { await db.exec(fs.readFileSync('supabase/preremplissage_infos_paiement_compte.sql', 'utf8')); return true })
console.log(`${ok}/${ok + ko}`)
