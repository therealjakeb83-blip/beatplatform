import { createClient } from '@/utils/supabase/server'

// V1 temporaire : pas de vrai système de rôles tant que l'étape 15 (Admin)
// n'est pas construite en profondeur — un seul admin (Jake), identifié par
// email. À remplacer par une vraie colonne de rôle le jour où la plateforme
// a plus d'un beatmaker à modérer.
const EMAIL_ADMIN = 'contact@jakebmusic.com'

export async function estAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === EMAIL_ADMIN
}
