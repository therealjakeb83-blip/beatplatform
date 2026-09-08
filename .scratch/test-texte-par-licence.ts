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
const LICENCE_WAV = '40c1f6c5-e3f1-483e-ae6b-dca9eec63f49'

async function main() {
  // 1. Sauvegarde un texte propre au MP3 uniquement, exactement comme la
  //    route API (validation d'appartenance + upsert par licence_id)
  const texteMp3 = 'CONTRAT DE LICENCE NON-EXCLUSIVE – {{type_licence}}\n\n[TEXTE PROPRE AU MP3 UNIQUEMENT]\n\nFait{{lieu_concedant}}, en date du {{date_achat}}.'
  const { error: upsertError } = await admin.from('licences_textes').upsert({
    licence_id: LICENCE_MP3,
    beatmaker_id: BEATMAKER_ID,
    contenu: texteMp3,
    version: 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'licence_id' })
  if (upsertError) throw new Error('Upsert MP3 échoué: ' + JSON.stringify(upsertError))
  console.log('1. Texte MP3 sauvegardé OK')

  // 2. Génère le contrat pour le MP3 → doit contenir le marqueur
  const pdfMp3 = await genererContratPdfPourVente(admin as never, {
    beatId: BEAT_ID, licenceId: LICENCE_MP3, beatmakerId: BEATMAKER_ID,
    acheteurNom: 'Test', acheteurEmail: 'test@example.com', acheteurAdresse: null,
    prixPaye: 25, splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }], dateVente: new Date(),
  })
  writeFileSync('.scratch/contrat-mp3-personnalise.pdf', pdfMp3)
  console.log('2. Contrat MP3 sauvegardé pour relecture:', pdfMp3.length, 'bytes')

  // 3. Génère le contrat pour le WAV (jamais édité) → doit utiliser le modèle par défaut, PAS le texte du MP3
  const pdfWav = await genererContratPdfPourVente(admin as never, {
    beatId: BEAT_ID, licenceId: LICENCE_WAV, beatmakerId: BEATMAKER_ID,
    acheteurNom: 'Test', acheteurEmail: 'test@example.com', acheteurAdresse: null,
    prixPaye: 45, splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }], dateVente: new Date(),
  })
  console.log('3. Contrat WAV généré:', pdfWav.length, 'bytes (doit être le modèle standard complet, pas le texte court du MP3)')

  console.log('4. Tailles comparées — MP3 (texte court):', pdfMp3.length, 'bytes / WAV (modèle complet):', pdfWav.length, 'bytes —', pdfWav.length > pdfMp3.length * 3 ? 'OK (WAV nettement plus long, confirme des textes indépendants)' : 'SUSPECT')

  // Nettoyage
  await admin.from('licences_textes').delete().eq('licence_id', LICENCE_MP3)
  console.log('5. Nettoyage OK')
}

main().catch(err => { console.error('ECHEC:', err); process.exit(1) })
