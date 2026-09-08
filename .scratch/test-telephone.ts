import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resoudreOuCreerClient } from '../lib/webhook-paiement.ts'

const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const email = 'nicojacob83+telephonetest@gmail.com'

  // Nettoyage préalable si un test précédent a laissé une trace
  await admin.from('clients').delete().eq('email', email)

  // 1. Création avec téléphone
  const id1 = await resoudreOuCreerClient(admin as never, email, 'Test Telephone', null, '+33612345678')
  const { data: c1 } = await admin.from('clients').select('telephone').eq('id', id1).single()
  console.log('1. Création avec téléphone:', c1?.telephone === '+33612345678' ? 'OK' : 'ECHEC — ' + c1?.telephone)

  // 2. Réutilisation avec un téléphone différent — ne doit PAS écraser
  await resoudreOuCreerClient(admin as never, email, 'Test Telephone', null, '+33699999999')
  const { data: c2 } = await admin.from('clients').select('telephone').eq('id', id1).single()
  console.log('2. Pas d\'écrasement:', c2?.telephone === '+33612345678' ? 'OK' : 'ECHEC — ' + c2?.telephone)

  // Nettoyage
  await admin.from('clients').delete().eq('id', id1)
  console.log('3. Nettoyage OK')
}
main().catch(err => { console.error('ECHEC:', err); process.exit(1) })
