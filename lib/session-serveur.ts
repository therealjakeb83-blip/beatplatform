import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'

// Rang 9e : « qui est connecté ? » reste vérifié auprès de Supabase
// (`getUser`, jamais une simple lecture du cookie), mais UNE fois par
// affichage : le cadre du dashboard et la page partagent la réponse au lieu
// de reposer chacun la question. `cache` de React ne vaut que pour un rendu
// serveur ; ailleurs (action serveur, route) chaque appel interroge Supabase.
export const utilisateurConnecte = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
