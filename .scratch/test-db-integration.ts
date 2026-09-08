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
const LICENCE_ID = 'ff4b6323-5364-4691-928f-090616637623'

async function main() {
  // 1. Simule exactement ce que fait PATCH /api/licences/textes
  const texteCustom = 'CONTRAT DE LICENCE NON-EXCLUSIVE – {{type_licence}}\n\n[TEXTE PERSONNALISE PAR LE BEATMAKER — MARQUEUR DE TEST]\n\nLe présent contrat est conclu entre :\n\n{{identite_concedant}}, ci-après dénommé « Le Concédant ».\n\nEt :\n\n{{identite_licencie}}, ci-après dénommé « Le Licencié ».\n{{bloc_collaborateurs}}\nFait{{lieu_concedant}}, en date du {{date_achat}}.'

  const { data: existant } = await admin
    .from('licences_textes')
    .select('version')
    .eq('beatmaker_id', BEATMAKER_ID)
    .eq('type_licence', 'standard')
    .maybeSingle()

  const { error: upsertError } = await admin.from('licences_textes').upsert({
    beatmaker_id: BEATMAKER_ID,
    type_licence: 'standard',
    contenu: texteCustom,
    version: (existant?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'beatmaker_id,type_licence' })

  if (upsertError) throw new Error('Upsert échoué: ' + JSON.stringify(upsertError))
  console.log('1. Upsert licences_textes OK (comme le ferait la route API)')

  // 2. Relit exactement comme le ferait la page dashboard (page.tsx)
  const { data: relu } = await admin
    .from('licences_textes')
    .select('contenu, version')
    .eq('beatmaker_id', BEATMAKER_ID)
    .eq('type_licence', 'standard')
    .maybeSingle()
  if (relu?.contenu !== texteCustom) throw new Error('Le texte relu ne correspond pas à ce qui a été enregistré')
  console.log('2. Relecture OK — version', relu.version, '— correspond exactement à ce qui a été sauvegardé')

  // 3. Génère un vrai contrat via le pipeline complet (comme au moment d'une vente)
  //    et vérifie que le texte personnalisé est bien utilisé (pas le modèle par défaut)
  const pdfBytes = await genererContratPdfPourVente(admin as never, {
    beatId: BEAT_ID,
    licenceId: LICENCE_ID,
    beatmakerId: BEATMAKER_ID,
    acheteurNom: 'Test Intégration',
    acheteurEmail: 'test@example.com',
    acheteurAdresse: '1 rue de Test, 75000 Paris',
    prixPaye: 25,
    splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }],
    dateVente: new Date(),
  })
  writeFileSync('.scratch/contrat-test-db-integration.pdf', pdfBytes)
  console.log('3. genererContratPdfPourVente OK —', pdfBytes.length, 'bytes, PDF sauvegardé pour inspection')

  // 4. Nettoyage — retire la ligne de test pour ne pas laisser de texte
  //    personnalisé bidon sur le vrai compte jakeb-test
  await admin.from('licences_textes').delete().eq('beatmaker_id', BEATMAKER_ID).eq('type_licence', 'standard')
  console.log('4. Nettoyage OK — ligne de test supprimée de licences_textes')
}

main().catch(err => { console.error('ECHEC:', err); process.exit(1) })
