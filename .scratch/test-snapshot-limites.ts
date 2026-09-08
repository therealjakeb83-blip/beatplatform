import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { genererContratPdfPourVente } from '../lib/contrat.ts'

const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const BEATMAKER_ID = 'd719df84-a92d-4dd0-aad9-6c45d55bf4d2'
const BEAT_ID = '85b7c41f-a4f8-42d8-9c81-d6d23f8e5c4d'
const LICENCE_MP3 = 'ff4b6323-5364-4691-928f-090616637623'

async function main() {
  // 0. Sauvegarde la limite actuelle du MP3 pour restauration finale
  const { data: licenceOriginale } = await admin.from('licences').select('streams_limite').eq('id', LICENCE_MP3).single()
  console.log('0. Limite streams MP3 actuelle:', licenceOriginale?.streams_limite)

  // 1. Simule une "vente" au moment où streams_limite = 50000 (snapshot figé)
  const snapshotVente = { streams_limite: 50000, ventes_physiques_limite: 2000, vues_video_limite: 200000, clips_video_limite: 1, radio_tv_limite: 1, lives_performances_autorise: false }
  const pdfAvantChangement = await genererContratPdfPourVente(admin as never, {
    beatId: BEAT_ID, licenceId: LICENCE_MP3, beatmakerId: BEATMAKER_ID,
    acheteurNom: 'Test Snapshot', acheteurEmail: 'test@example.com', acheteurAdresse: null,
    prixPaye: 25, splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }], dateVente: new Date(),
    limitesSnapshot: snapshotVente,
  })
  writeFileSync('.scratch/contrat-snapshot-avant.pdf', pdfAvantChangement)
  console.log('1. Contrat généré avec snapshot 50 000 streams:', pdfAvantChangement.length, 'bytes')

  // 2. Le beatmaker change la limite LIVE de la licence à 999999 (bien après la vente)
  await admin.from('licences').update({ streams_limite: 999999 }).eq('id', LICENCE_MP3)
  console.log('2. Limite live changée à 999 999 streams')

  // 3. Régénère le contrat de CETTE MÊME vente (comme reprendre-livraison) en repassant le même snapshot
  const pdfRegenere = await genererContratPdfPourVente(admin as never, {
    beatId: BEAT_ID, licenceId: LICENCE_MP3, beatmakerId: BEATMAKER_ID,
    acheteurNom: 'Test Snapshot', acheteurEmail: 'test@example.com', acheteurAdresse: null,
    prixPaye: 25, splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }], dateVente: new Date(),
    limitesSnapshot: snapshotVente, // même snapshot que la vente d'origine, PAS relu depuis licences
  })
  writeFileSync('.scratch/contrat-snapshot-regenere.pdf', pdfRegenere)
  console.log('3. Contrat régénéré (doit toujours afficher 50 000, pas 999 999):', pdfRegenere.length, 'bytes')

  // 4. Contre-test : SANS snapshot (comme avant ce correctif), doit maintenant refléter la nouvelle limite live
  const pdfSansSnapshot = await genererContratPdfPourVente(admin as never, {
    beatId: BEAT_ID, licenceId: LICENCE_MP3, beatmakerId: BEATMAKER_ID,
    acheteurNom: 'Test Snapshot', acheteurEmail: 'test@example.com', acheteurAdresse: null,
    prixPaye: 25, splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }], dateVente: new Date(),
  })
  writeFileSync('.scratch/contrat-snapshot-sans.pdf', pdfSansSnapshot)
  console.log('4. Contrat sans snapshot (doit afficher 999 999):', pdfSansSnapshot.length, 'bytes')

  // Nettoyage — remet la limite d'origine
  await admin.from('licences').update({ streams_limite: licenceOriginale?.streams_limite ?? null }).eq('id', LICENCE_MP3)
  console.log('5. Nettoyage OK — limite remise à', licenceOriginale?.streams_limite)
}
main().catch(err => { console.error('ECHEC:', err); process.exit(1) })
