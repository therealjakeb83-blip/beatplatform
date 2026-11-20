// Rang 9f, Lot 1 — T3 / T4 : déménagement des fichiers payants vers l'espace PRIVÉ.
// Lancé par Jake dans SON terminal (Claude ne lit jamais .env.local) :
//
//   node --env-file=.env.local .scratch/9f-lot1-T3-demenagement.mjs compter     ← à blanc, ne change RIEN
//   node --env-file=.env.local .scratch/9f-lot1-T3-demenagement.mjs deplacer    ← copie + base réécrite (originaux gardés)
//   node --env-file=.env.local .scratch/9f-lot1-T3-demenagement.mjs verifier    ← contrôle fichier par fichier
//   node --env-file=.env.local .scratch/9f-lot1-T3-demenagement.mjs effacer --oui  ← T4 : efface les originaux publics
//   node --env-file=.env.local .scratch/9f-lot1-T3-demenagement.mjs annuler     ← DÉFAIRE « deplacer » (avant « effacer » seulement)
//
// Concernés : MP3 tagué, MP3 propre, WAV, stems (beats/…), factures, contrats,
// avoirs (commandes/…). Couvertures, logos, images : ne bougent pas.
// Relançable sans risque : un fichier déjà copié (même taille) est sauté ;
// une ligne de base déjà « prive:… » est sautée. Rapport écrit dans .scratch/.
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { S3Client, ListObjectsV2Command, CopyObjectCommand, GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const mode = process.argv[2]
const confirme = process.argv.includes('--oui')
if (!['compter', 'deplacer', 'verifier', 'effacer', 'annuler'].includes(mode)) {
  console.log('Usage : compter | deplacer | verifier | effacer --oui | annuler')
  process.exit(1)
}

// Espace public actuel de Sonoo, fixé ici : le R2_BUCKET_NAME du PC de Jake vaut
// encore l'ancien espace (myproducer-beats) — vu le 2026-11-20.
const PUBLIC = 'sonoo'
const PRIVE = process.env.R2_BUCKET_PRIVE_NAME
// Adresse publique de l'espace « sonoo » (CLAUDE.md, 2026-10-17) : c'est elle
// qui est enregistrée en base, quelle que soit la valeur de R2_PUBLIC_URL du PC.
const ADRESSE_SONOO = 'https://pub-6a8b0d1a9a3a485ca052eb2596cbf6a4.r2.dev'
const PREFIXES_PUBLICS = [`${ADRESSE_SONOO}/`]
if (PUBLIC !== 'sonoo' || PRIVE !== 'sonoo-prive') {
  console.log(`R2_BUCKET_PRIVE_NAME lu dans .env.local : « ${PRIVE} ».`)
  console.log('Attendu : « sonoo-prive ». Rien n’a été fait.')
  process.exit(1)
}
if (mode === 'effacer' && !confirme) {
  console.log('Effacement des originaux : relance avec « effacer --oui » (après un « verifier » OK).')
  process.exit(1)
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
})
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const SENSIBLE = /^(beats\/[^/]+\/[^/]+\/(mp3_tague|mp3_propre|wav|stems)\.(mp3|wav|zip)|commandes\/.+\.pdf)$/
const COLONNES_BEAT = { mp3_tague_url: ['mp3_tague', 'mp3'], mp3_propre_url: ['mp3_propre', 'mp3'], wav_url: ['wav', 'wav'], stems_url: ['stems', 'zip'] }
const FICHIER_CORRESPONDANCES = '.scratch/9f-lot1-T3-correspondances.json'
const FICHIER_ANCIEN_ETAT = '.scratch/9f-lot1-T3-ancien-etat.json'
const taille = n => n > 1e9 ? `${(n / 1e9).toFixed(2)} Go` : `${(n / 1e6).toFixed(1)} Mo`

async function toutLire(table, colonnes) {
  const lignes = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from(table).select(colonnes).order('id').range(de, de + 999)
    if (error) throw new Error(`${table} : ${error.message}`)
    lignes.push(...data)
    if (data.length < 1000) return lignes
  }
}

async function lister(bucket) {
  const fichiers = new Map()
  let jeton
  do {
    const res = await r2.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: jeton }))
    for (const o of res.Contents ?? []) fichiers.set(o.Key, o.Size ?? 0)
    jeton = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (jeton)
  return fichiers
}

function classer(valeur) {
  if (!valeur) return { etat: 'vide' }
  if (valeur.startsWith('prive:')) return { etat: 'prive', cle: valeur.slice(6) }
  const prefixe = PREFIXES_PUBLICS.find(p => valeur.startsWith(p))
  if (prefixe) return { etat: 'public', cle: valeur.slice(prefixe.length) }
  return { etat: 'inconnu' }
}

// 1. Ce que la base référence
const plan = []       // { table, id, colonne, ancienne, source, cible }
const dejaPrives = [] // { table, id, colonne, cle }
const inconnus = []   // adresses hors de l'espace public actuel (ancien espace…)
function noter(table, id, colonne, valeur, cible) {
  const c = classer(valeur)
  if (c.etat === 'vide') return
  if (c.etat === 'prive') return dejaPrives.push({ table, id, colonne, cle: c.cle })
  if (c.etat === 'inconnu') return inconnus.push({ table, id, colonne, debut: String(valeur).slice(0, 40) })
  plan.push({ table, id, colonne, ancienne: valeur, source: c.cle, cible: cible ?? c.cle })
}

const [beats, commandes, tranches, avoirs, lignes] = await Promise.all([
  toutLire('beats', 'id, beatmaker_id, mp3_tague_url, mp3_propre_url, wav_url, stems_url'),
  toutLire('commandes', 'id, facture_pdf_url'),
  toutLire('commande_tranches', 'id, facture_pdf_url'),
  toutLire('avoirs', 'id, pdf_url'),
  toutLire('commande_lignes', 'id, contrat_pdf_url'),
])
for (const b of beats) for (const [col, [type, ext]] of Object.entries(COLONNES_BEAT)) {
  noter('beats', b.id, col, b[col], `beats/${b.beatmaker_id}/${b.id}/${type}.${ext}`)
}
for (const c of commandes) noter('commandes', c.id, 'facture_pdf_url', c.facture_pdf_url)
for (const t of tranches) noter('commande_tranches', t.id, 'facture_pdf_url', t.facture_pdf_url)
for (const a of avoirs) noter('avoirs', a.id, 'pdf_url', a.pdf_url)
for (const l of lignes) noter('commande_lignes', l.id, 'contrat_pdf_url', l.contrat_pdf_url)

// 2. Ce que contient l'espace public
const publics = await lister(PUBLIC)
const sensibles = [...publics.entries()].filter(([k]) => SENSIBLE.test(k))
const referencees = new Set(plan.map(p => p.source))
const correspondancesConnues = existsSync(FICHIER_CORRESPONDANCES) ? JSON.parse(readFileSync(FICHIER_CORRESPONDANCES, 'utf8')) : {}
// Fichiers sensibles que la base ne (ou ne plus) référence en public : copiés
// à leur place connue (déjà déménagés) ou sous la même clé.
const orphelins = sensibles.filter(([k]) => !referencees.has(k)).map(([k, n]) => ({ source: k, cible: correspondancesConnues[k] ?? k, octets: n }))
const absents = plan.filter(p => !publics.has(p.source))
const aCopier = [
  ...plan.filter(p => publics.has(p.source)).map(p => ({ source: p.source, cible: p.cible, octets: publics.get(p.source) })),
  ...orphelins,
]
const copiesUniques = [...new Map(aCopier.map(c => [`${c.source}→${c.cible}`, c])).values()]

const rapport = {
  mode,
  espaces: { public: PUBLIC, prive: PRIVE, adresse_publique_en_base: ADRESSE_SONOO },
  date: new Date().toISOString(),
  base: { a_deplacer: plan.length, deja_prives: dejaPrives.length, adresse_inconnue: inconnus.length, fichier_absent: absents.length },
  par_colonne: Object.fromEntries([...new Set(plan.map(p => `${p.table}.${p.colonne}`))].map(k => [k, plan.filter(p => `${p.table}.${p.colonne}` === k).length])),
  espace_public: { fichiers: publics.size, sensibles: sensibles.length, orphelins: orphelins.length },
  copies: copiesUniques.length,
  volume: taille(copiesUniques.reduce((a, c) => a + c.octets, 0)),
  cle_renommee: plan.filter(p => p.source !== p.cible).length,
  exemples_absents: absents.slice(0, 10).map(p => `${p.table}.${p.colonne} ${p.id}`),
  adresses_inconnues_par_debut: Object.fromEntries([...new Set(inconnus.map(i => i.debut.slice(0, 30)))].map(d => [d, inconnus.filter(i => i.debut.startsWith(d)).length])),
}

async function copierUn({ source, cible, octets }) {
  try {
    const t = await r2.send(new HeadObjectCommand({ Bucket: PRIVE, Key: cible }))
    if (t.ContentLength === octets) return 'deja'
  } catch { /* absent : on copie */ }
  try {
    await r2.send(new CopyObjectCommand({ Bucket: PRIVE, Key: cible, CopySource: `${PUBLIC}/${source.split('/').map(encodeURIComponent).join('/')}` }))
  } catch {
    const src = await r2.send(new GetObjectCommand({ Bucket: PUBLIC, Key: source }))
    await r2.send(new PutObjectCommand({ Bucket: PRIVE, Key: cible, Body: Buffer.from(await src.Body.transformToByteArray()), ContentType: src.ContentType }))
  }
  const v = await r2.send(new HeadObjectCommand({ Bucket: PRIVE, Key: cible }))
  if (v.ContentLength !== octets) throw new Error(`taille différente après copie (${v.ContentLength} ≠ ${octets})`)
  return 'copie'
}

async function enParallele(elements, travail, n = 8) {
  const file = [...elements]
  await Promise.all(Array.from({ length: n }, async () => { while (file.length) await travail(file.shift()) }))
}

if (mode === 'deplacer') {
  let copies = 0, deja = 0
  const erreurs = []
  const reussies = new Set()
  await enParallele(copiesUniques, async c => {
    try { (await copierUn(c)) === 'copie' ? copies++ : deja++; reussies.add(`${c.source}→${c.cible}`) }
    catch (e) { erreurs.push(`${c.source} : ${e.message}`) }
    if ((copies + deja + erreurs.length) % 50 === 0) console.log(`… ${copies + deja + erreurs.length}/${copiesUniques.length}`)
  })
  // Base réécrite UNIQUEMENT pour les fichiers copiés et vérifiés, filtre exact
  // sur l'ancienne valeur (une ligne changée entre-temps n'est pas touchée).
  let reecrites = 0
  const erreursBase = []
  // Ancien état de chaque ligne réécrite (pour « annuler »), cumulé entre les passages.
  const ancienEtat = existsSync(FICHIER_ANCIEN_ETAT) ? JSON.parse(readFileSync(FICHIER_ANCIEN_ETAT, 'utf8')) : []
  for (const p of plan.filter(p => reussies.has(`${p.source}→${p.cible}`))) ancienEtat.push({ table: p.table, id: p.id, colonne: p.colonne, ancienne: p.ancienne, nouvelle: `prive:${p.cible}` })
  writeFileSync(FICHIER_ANCIEN_ETAT, JSON.stringify(ancienEtat, null, 1))
  await enParallele(plan.filter(p => reussies.has(`${p.source}→${p.cible}`)), async p => {
    const { data, error } = await db.from(p.table).update({ [p.colonne]: `prive:${p.cible}` }).eq('id', p.id).eq(p.colonne, p.ancienne).select('id')
    if (error) erreursBase.push(`${p.table}.${p.colonne} ${p.id} : ${error.message}`)
    else reecrites += data.length
  }, 4)
  Object.assign(rapport, { copies_faites: copies, deja_presentes: deja, erreurs_copie: erreurs, lignes_reecrites: reecrites, erreurs_base: erreursBase })
  // Correspondances original public → copie privée, cumulées entre les passages (pour « effacer »).
  const ancien = existsSync(FICHIER_CORRESPONDANCES) ? JSON.parse(readFileSync(FICHIER_CORRESPONDANCES, 'utf8')) : {}
  for (const c of copiesUniques) if (reussies.has(`${c.source}→${c.cible}`)) ancien[c.source] = c.cible
  writeFileSync(FICHIER_CORRESPONDANCES, JSON.stringify(ancien, null, 1))
}

if (mode === 'verifier' || mode === 'effacer') {
  const prives = await lister(PRIVE)
  const privesManquants = dejaPrives.filter(p => !prives.has(p.cle))
  const orphelinsNonCopies = orphelins.filter(o => prives.get(o.cible) !== o.octets)
  Object.assign(rapport, {
    lignes_encore_publiques: plan.length,
    lignes_privees: dejaPrives.length,
    lignes_privees_sans_fichier: privesManquants.length,
    exemples_sans_fichier: privesManquants.slice(0, 10).map(p => `${p.table}.${p.colonne} ${p.id}`),
    orphelins_non_copies: orphelinsNonCopies.length,
    originaux_sensibles_restants: sensibles.length,
  })
  rapport.resultat = plan.length === 0 && privesManquants.length === 0 && orphelinsNonCopies.length === 0
    ? 'OK : toute la base pointe vers l’espace privé et chaque fichier y est'
    : 'INCOMPLET : relance « deplacer » puis « verifier »'

  if (mode === 'effacer') {
    if (!rapport.resultat.startsWith('OK')) {
      console.log('Effacement REFUSÉ : la vérification n’est pas OK.')
    } else {
      // Un original n'est effacé que si sa copie privée existe avec la même taille.
      const correspondances = existsSync(FICHIER_CORRESPONDANCES) ? JSON.parse(readFileSync(FICHIER_CORRESPONDANCES, 'utf8')) : {}
      let effaces = 0
      const gardes = []
      await enParallele(sensibles, async ([cle, octets]) => {
        const cible = correspondances[cle] ?? cle
        if (prives.get(cible) !== octets) return gardes.push(cle)
        await r2.send(new DeleteObjectCommand({ Bucket: PUBLIC, Key: cle }))
        effaces++
      })
      Object.assign(rapport, { originaux_effaces: effaces, originaux_gardes_sans_copie_identique: gardes.length, exemples_gardes: gardes.slice(0, 10) })
    }
  }
}

if (mode === 'annuler') {
  // Remet l'ancienne adresse publique, seulement là où la ligne vaut encore la
  // valeur posée par « deplacer ». Les copies privées restent (sans effet).
  const ancienEtat = existsSync(FICHIER_ANCIEN_ETAT) ? JSON.parse(readFileSync(FICHIER_ANCIEN_ETAT, 'utf8')) : []
  let remises = 0
  const erreurs = []
  await enParallele(ancienEtat, async e => {
    const { data, error } = await db.from(e.table).update({ [e.colonne]: e.ancienne }).eq('id', e.id).eq(e.colonne, e.nouvelle).select('id')
    if (error) erreurs.push(`${e.table}.${e.colonne} ${e.id} : ${error.message}`)
    else remises += data.length
  }, 4)
  Object.assign(rapport, { lignes_remises_en_public: remises, erreurs_annulation: erreurs })
}

const fichier = `.scratch/9f-lot1-T3-rapport-${mode}.json`
writeFileSync(fichier, JSON.stringify(rapport, null, 2))
console.log(JSON.stringify(rapport, null, 2))
console.log(`\nRapport enregistré : ${fichier}`)
