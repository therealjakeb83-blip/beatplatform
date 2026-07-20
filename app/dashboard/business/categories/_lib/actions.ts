'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const CHEMIN = '/dashboard/business/categories'

export async function demanderCertification(categorieId: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { error } = await supabase
    .from('demandes_certification')
    .insert({ categorie_id: categorieId, beatmaker_id: user.id })
  if (error) return { erreur: error.code === '23505' ? 'Une demande est déjà en attente pour cette catégorie.' : error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function annulerDemandeCertification(categorieId: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { error } = await supabase
    .from('demandes_certification')
    .delete()
    .eq('categorie_id', categorieId)
    .eq('beatmaker_id', user.id)
    .eq('statut', 'en_attente')
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function renommerCategoriePerso(categorieId: string, nouveauNom: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  // Renommage atomique (categories + cascade sur les beats concernés) via
  // fonction Postgres — voir supabase/phase7_8_categories_images.sql. La
  // fonction vérifie elle-même la propriété et l'absence de certification.
  const { error } = await supabase.rpc('renommer_categorie_perso', {
    p_categorie_id: categorieId,
    p_nouveau_nom: nouveauNom,
  })
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  revalidatePath('/dashboard/business/beats')
  return {}
}

export async function supprimerCategoriePersonnelle(categorieId: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { data: demandeEnCours } = await supabase
    .from('demandes_certification')
    .select('id')
    .eq('categorie_id', categorieId)
    .eq('statut', 'en_attente')
    .maybeSingle()
  if (demandeEnCours) return { erreur: 'Annule d\'abord ta demande de certification avant de supprimer cette catégorie.' }

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
