// Crée les comptes nicojacob83+test1@gmail.com ... +test8@gmail.com
// via l'API admin Supabase (auth.users). Le trigger handle_new_beatmaker
// (supabase/fix_trigger_role.sql) crée ensuite automatiquement la ligne
// beatmakers correspondante — même flux qu'une inscription normale.
//
// Usage : node --env-file=.env.local scripts/creer-comptes-test.mjs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const MOT_DE_PASSE = 'MyProducerTest2026!'

const comptes = Array.from({ length: 10 }, (_, i) => ({
  email: `nicojacob83+test${i + 1}@gmail.com`,
  nom_artiste: `Jake B Test ${i + 1}`,
}))

for (const { email, nom_artiste } of comptes) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: MOT_DE_PASSE,
    email_confirm: true,
    user_metadata: { nom_artiste, role: 'beatmaker' },
  })

  if (error) {
    console.error(`❌ ${email} : ${error.message}`)
    continue
  }

  console.log(`✅ ${email} créé (id ${data.user.id})`)
}

console.log(`\nMot de passe utilisé pour les 8 comptes : ${MOT_DE_PASSE}`)
