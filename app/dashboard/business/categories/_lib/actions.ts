'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

const CHEMIN = '/dashboard/business/categories'

// V1 temporaire : pas de vrai système de rôles/admin tant que l'étape 15
// (Admin) n'est pas construite — la modération est absorbée par cette page
// jusque-là, réservée à Jake par email (voir ROADMAP.md Phase 7, note
// "validation manuelle en V1").
const EMAIL_MODERATEUR = 'contact@jakebmusic.com'

export async function estModerateur(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === EMAIL_MODERATEUR
}

export async function demanderCertification(categorieId: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { error } = await supabase
    .from('categories')
    .update({ statut: 'en_attente_certification' })
    .eq('id', categorieId)
    .eq('beatmaker_id', user.id)
    .eq('statut', 'active')
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function annulerDemandeCertification(categorieId: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { error } = await supabase
    .from('categories')
    .update({ statut: 'active' })
    .eq('id', categorieId)
    .eq('beatmaker_id', user.id)
    .eq('statut', 'en_attente_certification')
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function supprimerCategoriePersonnelle(categorieId: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categorieId)
    .eq('beatmaker_id', user.id)
    .eq('statut', 'active')
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}

// Approuver/rejeter passent par service_role : la RLS interdit volontairement
// à un beatmaker de se certifier lui-même (WITH CHECK sur la policy update),
// donc même Jake (en tant que beatmaker) ne peut pas le faire via le client
// RLS-bound — cohérent avec "vraie modération = étape 15" à venir.
export async function approuverCertification(categorieId: string): Promise<{ erreur?: string }> {
  if (!(await estModerateur())) return { erreur: 'Non autorisé.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('categories')
    .update({ statut: 'certifiee' })
    .eq('id', categorieId)
    .eq('statut', 'en_attente_certification')
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function rejeterCertification(categorieId: string): Promise<{ erreur?: string }> {
  if (!(await estModerateur())) return { erreur: 'Non autorisé.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('categories')
    .update({ statut: 'active' })
    .eq('id', categorieId)
    .eq('statut', 'en_attente_certification')
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}
