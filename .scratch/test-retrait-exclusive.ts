import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const bmId = 'd719df84-a92d-4dd0-aad9-6c45d55bf4d2' // jakeb-test
  const { data: beat } = await admin.from('beats').select('id, statut').eq('beatmaker_id', bmId).eq('statut', 'public').limit(1).maybeSingle()
  if (!beat) { console.log('Aucun beat public trouvé pour le test — rien à tester, pas d\'erreur'); return }

  console.log('1. Beat de test:', beat.id, '— statut initial:', beat.statut)

  // Simule exactement ce que fait finaliserCommandePayee après une vente Exclusive
  const { error } = await admin.from('beats').update({ statut: 'vendu' }).eq('id', beat.id)
  if (error) throw new Error('Update échoué: ' + JSON.stringify(error))

  const { data: relu } = await admin.from('beats').select('statut').eq('id', beat.id).single()
  console.log('2. Statut après "vente Exclusive":', relu?.statut, relu?.statut === 'vendu' ? 'OK' : 'ECHEC')

  // Vérifie que la boutique publique ne le retournerait plus (même filtre que app/[slug]/beats/page.tsx)
  const { data: visiblePublic } = await admin.from('beats').select('id').eq('id', beat.id).eq('statut', 'public').maybeSingle()
  console.log('3. Invisible en boutique publique (filtre statut=public):', !visiblePublic ? 'OK' : 'ECHEC')

  // Vérifie que l'historique analytics le retrouve toujours (aucun filtre sur beats.statut)
  const { data: toujoursLa } = await admin.from('beats').select('id, titre').eq('id', beat.id).maybeSingle()
  console.log('4. Toujours présent en base pour les analytics:', toujoursLa ? 'OK (' + toujoursLa.titre + ')' : 'ECHEC')

  // Nettoyage — remet le beat dans son état d'origine
  await admin.from('beats').update({ statut: beat.statut }).eq('id', beat.id)
  console.log('5. Nettoyage OK — statut remis à', beat.statut)
}
main().catch(err => { console.error('ECHEC:', err); process.exit(1) })
