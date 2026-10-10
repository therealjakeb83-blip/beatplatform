// Test du vrai handler avec une base simulée : aucun email ni accès réseau.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function charger(fichier, imports) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(fichier, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { exports, require: nom => {
    assert.ok(nom in imports, `Import inattendu : ${nom}`)
    return imports[nom]
  }, process: { env: { CRON_SECRET: 'test' } }, console, Date, Map, Set })
  return exports
}

const aides = charger('app/dashboard/business/_lib/requetes.ts', {})
const anciennes = Array.from({ length: 2205 }, (_, i) => ({
  id: `commande-${String(i).padStart(5, '0')}`, client_id: `client-${i}`,
  created_at: '2020-01-01T00:00:00Z', beatmaker_id: 'boutique', type_commande: 'LICENCE',
}))
const recentes = ['LICENCE', 'CREATION_ABONNEMENT', 'RENOUVELLEMENT'].map((type_commande, i) => ({
  ...anciennes[i], id: `recente-${i}`, created_at: new Date().toISOString(), type_commande,
}))
const tables = {
  automatisations: [{ id: 'auto', beatmaker_id: 'boutique', type: 'relance_inactivite', actif: true, config: { mois_inactivite: 3 } }],
  commandes: [...anciennes, ...recentes],
  automatisation_evenements: anciennes.slice(3, 1508).map((c, i) => ({
    id: `evenement-${String(i).padStart(5, '0')}`, beatmaker_id: 'boutique', type: 'relance_inactivite', reference_id: c.id,
  })),
  // Les ventes importées ne doivent jamais être interrogées.
  commandes_externes: [{ id: 'importe', client_id: 'importe-seul' }],
}
const lectures = []
const insertions = []
let erreurTable = null
const admin = { from(table) {
  assert.notEqual(table, 'commandes_externes')
  let lignes = [...tables[table]]
  const ordres = []
  const q = {
    select() { return q },
    eq(champ, valeur) { lignes = lignes.filter(l => l[champ] === valeur); return q },
    in(champ, valeurs) { lignes = lignes.filter(l => valeurs.includes(l[champ])); return q },
    not(champ, operateur, valeur) { assert.equal(operateur, 'is'); lignes = lignes.filter(l => l[champ] !== valeur); return q },
    order(champ, options) { ordres.push([champ, options?.ascending !== false]); return q },
    range(debut, fin) {
      lectures.push([table, debut, fin])
      lignes.sort((a, b) => {
        for (const [champ, asc] of ordres) {
          const ordre = String(a[champ]).localeCompare(String(b[champ]))
          if (ordre) return asc ? ordre : -ordre
        }
        return 0
      })
      return Promise.resolve({ data: lignes.slice(debut, fin + 1), error: erreurTable === table ? { message: 'lecture impossible' } : null })
    },
    insert(valeur) { insertions.push(valeur); return Promise.resolve({ error: null }) },
  }
  return q
} }
const { GET } = charger('app/api/cron/scans-automatisations/route.ts', {
  '@/utils/supabase/admin': { createAdminClient: () => admin },
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/app/dashboard/business/_lib/requetes': aides,
})

;(async () => {
  const request = { headers: { get: () => 'Bearer test' } }
  assert.equal((await GET({ headers: { get: () => null } })).status, 401)
  const resultat = await GET(request)
  assert.equal(resultat.body.relance_inactivite, 697)
  assert.equal(insertions.length, 697)
  assert.equal(new Set(insertions.map(e => e.client_id)).size, 697)
  assert.ok(insertions.some(e => e.client_id === 'client-2204'))
  assert.ok(!insertions.some(e => ['client-0', 'client-1', 'client-2', 'client-1507', 'importe-seul'].includes(e.client_id)))
  assert.ok(lectures.some(([table, debut]) => table === 'commandes' && debut === 2000))
  assert.ok(lectures.some(([table, debut]) => table === 'automatisation_evenements' && debut === 1000))
  tables.automatisation_evenements.push(...insertions.map((e, i) => ({ ...e, id: `nouveau-${i}` })))
  insertions.length = 0
  assert.equal((await GET(request)).body.relance_inactivite, 0)
  // Une lecture qui échoue ne doit pas produire de relances sur un historique incomplet.
  erreurTable = 'automatisation_evenements'
  await assert.rejects(() => GET(request), /Lecture des données CRM impossible/)
  assert.equal(insertions.length, 0)
  // Vérifie aussi la pagination des boutiques actives, au-delà de la limite.
  erreurTable = null
  tables.automatisations = Array.from({ length: 1001 }, (_, i) => ({ ...tables.automatisations[0], id: String(i).padStart(5, '0'), beatmaker_id: `vide-${i}` }))
  assert.equal((await GET(request)).body.relance_inactivite, 0)
  assert.ok(lectures.some(([table, debut]) => table === 'automatisations' && debut === 1000))
  console.log('OK — 2 208 commandes, 1 505 relances historiques, achats/abonnements récents, second scan sans doublon, erreur de lecture, 1 001 boutiques actives.')
})().catch(erreur => { console.error(erreur); process.exitCode = 1 })
