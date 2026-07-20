'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { estAdmin } from '@/lib/admin'
import type { TypeCategorie } from '@/lib/categories'

const CHEMIN = '/dashboard/admin/categories'

// Toutes ces actions passent par service_role : la RLS interdit
// volontairement à un beatmaker (y compris Jake, en tant que beatmaker) de
// se certifier ou de gérer les catégories plateforme via le client
// RLS-bound (WITH CHECK sur la policy UPDATE de `categories`) — seule la
// modération explicite, gardée par estAdmin(), peut le faire.

export async function approuverCertification(categorieId: string): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

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
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

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

export async function ajouterCategoriePlateforme(type: TypeCategorie, nom: string): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  const valeur = nom.trim()
  if (!valeur) return { erreur: 'Nom vide.' }

  const admin = createAdminClient()
  const { error } = await admin.from('categories').insert({ type, nom: valeur, source: 'plateforme' })
  if (error) return { erreur: error.code === '23505' ? 'Cette catégorie existe déjà.' : error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function supprimerCategoriePlateforme(categorieId: string): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('categories')
    .delete()
    .eq('id', categorieId)
    .eq('source', 'plateforme')
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}
