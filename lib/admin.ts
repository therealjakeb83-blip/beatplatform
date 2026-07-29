import { createClient } from '@/utils/supabase/server'

// V1 : un seul rôle spécial (admin), colonne beatmakers.role — déconnecté du
// slug depuis l'audit du 2026-07-29 (un slug est renommable par le
// beatmaker via /dashboard/profil, un rôle ne l'est jamais via ce
// formulaire). Voir supabase/admin_role_field.sql.
export function estRoleAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}

export async function estAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: beatmaker } = await supabase.from('beatmakers').select('role').eq('id', user.id).single()
  return estRoleAdmin(beatmaker?.role)
}
