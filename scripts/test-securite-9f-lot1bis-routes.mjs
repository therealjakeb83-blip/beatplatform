// Exécute les vraies routes avec données fictives et adaptateurs simulés. Aucun .env/réseau/email.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createRequire } from 'node:module'
const chargerNatif = createRequire(import.meta.url)

function charger(fichier, modules = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(fichier, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const importer = nom => {
      if (nom in modules) return modules[nom]
      if (nom.startsWith('.')) return charger(path.resolve(path.dirname(fichier), `${nom}.ts`), modules)
      return chargerNatif(nom)
  }
  new Function('exports', 'require', 'process', code)(exports, importer, { env: {} })
  return exports
}
function requetes(repondre) {
  return { from(table) {
    const q = { table, filtres: [], colonnes: '' }
    for (const m of ['eq','in','or','order','range']) q[m] = (...args) => { q.filtres.push([m,...args]); return q }
    q.select = v => { q.colonnes = v; return q }
    q.single = q.maybeSingle = () => Promise.resolve(repondre(q, true))
    q.then = (ok, ko) => Promise.resolve(repondre(q, false)).then(ok, ko)
    return q
  } }
}
;(async () => {
  let cas = 0
  const { genererContratPdfPourVente } = charger('lib/contrat.ts')
  const params = { beatId:'beat-a', licenceId:'licence-a', beatmakerId:'a', acheteurNom:'Acheteur fictif', acheteurEmail:'a@example.invalid', acheteurAdresse:null, prixPaye:10, splits:[], dateVente:new Date('2026-11-20') }
  let texte = { beatmaker_id:'b', licence_id:'licence-a', contenu:'TEXTE ETRANGER' }, erreur = false, vendeurLicence = 'a'
  const admin = requetes(q => {
    const proprietaire = q.filtres.find(x => x[1] === 'beatmaker_id')?.[2]
    if (q.table === 'beats') return { data:{titre:'Beat fictif'} }
    if (q.table === 'beatmakers') return { data:{nom_artiste:'Vendeur fictif',slug:'fictif',raison_sociale:'Test',adresse:'Adresse fictive'} }
    if (q.table === 'licences') return { data:proprietaire === vendeurLicence ? {nom:'WAV',modele:'standard',inclut_mp3:true,inclut_wav:true} : null }
    assert.equal(q.table, 'licences_textes')
    assert.equal(proprietaire, 'a')
    return { data:texte?.beatmaker_id === proprietaire ? texte : null, error:erreur ? {code:'indisponible'} : null }
  })
  const pdf = await genererContratPdfPourVente(admin, params)
  assert.equal(Buffer.from(pdf).subarray(0,4).toString(), '%PDF'); cas++
  texte = { beatmaker_id:'a',licence_id:'licence-a',contenu:'Texte personnel fictif' }
  assert.ok((await genererContratPdfPourVente(admin, params)).length > 100); cas++
  erreur = true
  await assert.rejects(genererContratPdfPourVente(admin, params), /Lecture du texte/); cas++
  erreur = false; vendeurLicence = 'b'
  await assert.rejects(genererContratPdfPourVente(admin, params), /Données manquantes/); cas++

  const lignes = [
    {id:'own',created_at:'2026-11-20T10:00:00Z',prix_paye:10,reduction_montant:2,source_marketing:'youtube',acheteur_nom:'Propre',client_id:'c'},
    {id:'other',created_at:'2026-11-20T10:00:00Z',prix_paye:100,reduction_montant:0,source_marketing:'instagram',acheteur_nom:'Etranger',acheteur_email:'secret@example.invalid'},
  ]
  let connecte = true
  const selectEtrangers = []
  const db = requetes((q, unique) => {
    if (q.table === 'beatmakers') return {data:{tva_active:false,fuseau_horaire:'Europe/Paris'}}
    if (q.table === 'commande_lignes') return {data:[]}
    assert.equal(q.table, 'commandes')
    if (q.filtres.some(x => x[0] === 'in' && x[1] === 'id')) {
      selectEtrangers.push(q.colonnes)
      return {data:[Object.fromEntries(q.colonnes.split(',').map(c => c.trim()).map(c => [c,lignes[1][c]]))]}
    }
    assert.equal(unique, false)
    return {data:[lignes[0]]}
  })
  const modules = {
    '@/utils/supabase/server': {createClient:async () => ({auth:{getUser:async () => ({data:{user:connecte ? {id:'a'} : null}})}})},
    '@/utils/supabase/admin': {createAdminClient:() => db},
    '@/app/dashboard/business/_lib/fiche-boutique':{remplacerClientsParFiches:async (_,__,rows) => rows},
    'next/server':{NextResponse:Response},
    '@/app/dashboard/business/analytics/_lib/periode': {
      getPeriodDates:() => ({from:null,to:null,periode:'tout'}), inPeriod:() => true,
      getHistoriqueSlots:() => [{label:'Novembre',fullLabel:'Novembre 2026',from:'2026-11-01',to:'2026-12-01'}],
    },
    '@/lib/fuseau-horaire':{fuseauSur:x=>x},
    '@/lib/analytics-parts':{
      chargerPartsVendeur:async()=>({autresCommandes:['other']}),chargerFluxCollab:async()=>({recus:[],collaborateurs:[]}),
      partsDeCommandes:rows=>rows.map(r=>r.id==='other'?{...r,prix_paye:20}:r),partsDeLignes:rows=>rows,STATUTS_ANALYTICS:['payee'],
    },
    '@/lib/sources-marketing':{SOURCE_LABELS:{youtube:'YouTube',instagram:'Instagram',direct:'Direct'},SOURCES_MARKETING:['youtube','instagram','direct']},
    '@/app/dashboard/business/_lib/requetes':{toutesLesLignes:async fn=>(await fn(0,999)).data,parLots:async(ids,fn)=>ids.length?(await fn(ids)).data:[]},
  }
  const route = charger('app/api/business/analytics/ventes/route.ts', modules)
  const appel = async()=> (await route.GET(new Request('https://site.invalid/?periode=tout'))).json()
  const r = await appel()
  assert.equal(r.kpis.ca_brut,32)
  assert.equal(r.commandes.find(c=>c.id==='other').source_marketing,null)
  assert.equal(r.commandes.find(c=>c.id==='other').client_nom,'—')
  assert.equal(r.commandes.find(c=>c.id==='own').source_marketing,'youtube')
  assert.equal(r.kpis.source_top.nom,'YouTube')
  assert.equal(r.kpis.source_top.ca,12)
  assert.equal(r.historique[0].instagram,0)
  assert.equal(r.historique[0].direct,0)
  assert.equal(r.historique[0].youtube,12)
  assert.ok(selectEtrangers.every(s=>!s.includes('source_marketing')&&!s.includes('acheteur_'))); cas++
  lignes[1].source_marketing='newsletter'; lignes[1].acheteur_nom='Autre secret'
  assert.deepEqual(await appel(),r); cas++
  lignes[0].source_marketing=null
  const direct = await appel()
  assert.equal(direct.commandes.find(c=>c.id==='own').source_marketing,'direct')
  assert.equal(direct.historique[0].direct,12); cas++
  connecte=false
  assert.equal((await route.GET(new Request('https://site.invalid/'))).status,401); cas++

  class Erreur extends Error {}
  let nbGlobaux = 1
  const importModules = {
    '@/utils/supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:{nb_commandes:1,nb_lignes:2,nb_contacts_crees:1,nb_clients_crees:nbGlobaux,champ_futur_secret:'secret'}})})},
    '@/lib/import-externe/preparation':{ErreurImport:Erreur},'@/lib/import-externe/taux-bce':{ErreurTauxBce:Erreur},
    '@/lib/import-externe/libre/tableau':{ErreurTableau:Erreur},'@/lib/import-externe/libre/association':{ErreurAssociation:Erreur},
    '@/lib/import-externe/entree':{preparerFichier:async()=>({preparation:{commandes:[{lignes:[]}],contacts:[],importMeta:{}}})},
    '@/lib/import-externe/route-commun':{beatmakerImport:async()=>({beatmakerId:'a'}),lireFichierRequete:async()=>({octets:[],nom:'fictif.csv'}),reponseJson:Response.json.bind(Response)},
    '@/lib/import-externe/liens-beats':{beatsMemorisesParCle:async()=>new Map(),chargerGroupesTitres:async()=>({groupes:[]}),normaliserTitre:x=>x},
  }
  const importer = charger('app/api/business/imports-externes/importer/route.ts',importModules)
  const resultat = await (await importer.POST({})).json()
  assert.deepEqual(resultat,{resultat:{nb_commandes:1,nb_lignes:2,nb_contacts_crees:1,nb_titres_non_relies:0}})
  nbGlobaux=0
  assert.deepEqual(await (await importer.POST({})).json(),resultat); cas++
  console.log(`${cas} scénarios routes/contrats OK : PDF réel, refus propriétaire/erreur, sources et import indépendants des données étrangères`)
})().catch(e=>{console.error(e);process.exitCode=1})
