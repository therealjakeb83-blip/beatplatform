import { createClient } from '@/utils/supabase/server'

// V1 temporaire : pas de vrai système de rôles tant que l'étape 15 (Admin)
// n'est pas construite en profondeur — un seul admin (Jake), identifié par
// le slug de sa boutique de test plutôt que par email (plus stable, déjà
// connu). À remplacer par une vraie colonne de rôle le jour où la
// plateforme a plus d'un beatmaker à modérer.
// Exporté pour que suspendreAction (app/dashboard/admin/boutiques/[id]/_lib/actions.ts)
// puisse refuser de suspendre ce compte précis — incident 2026-07-24 : Jake
// s'est suspendu lui-même et s'est retrouvé bloqué hors de /dashboard/admin,
// puisque estAdmin() dépend de ce même statut.
export const SLUG_ADMIN = 'jakeb-test'

export async function estAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: beatmaker } = await supabase.from('beatmakers').select('slug').eq('id', user.id).single()
  return beatmaker?.slug === SLUG_ADMIN
}
