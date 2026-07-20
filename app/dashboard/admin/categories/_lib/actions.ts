'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { estAdmin } from '@/lib/admin'
import type { TypeCategorie } from '@/lib/categories'
import { envoyerCategorieCertifiee } from '@/lib/emails'

const CHEMIN = '/dashboard/admin/categories'

// Toutes ces actions passent par service_role : la RLS interdit
// volontairement à un beatmaker (y compris Jake, en tant que beatmaker) de
// se certifier ou de gérer les catégories plateforme via le client
// RLS-bound (WITH CHECK sur la policy UPDATE de `categories`) — seule la
// modération explicite, gardée par estAdmin(), peut le faire.

// Approuver/rejeter agit sur un GROUPE de demandes (même nom, casse
// ignorée) via une fonction Postgres atomique — voir
// supabase/phase7_10_regroupement_certification.sql. `nomGroupe` sert
// uniquement à retrouver le groupe (n'importe quelle casse du groupe
// fonctionne, la fonction normalise) ; `nomFinal` est la casse définitive
// choisie par l'admin, qui écrase toutes les variantes.
export async function approuverCertificationGroupe(type: TypeCategorie, nomGroupe: string, nomFinal: string): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  const valeur = nomFinal.trim()
  if (!valeur) return { erreur: 'Nom final requis.' }

  const admin = createAdminClient()

  // Beatmakers concernés AVANT la fusion (perso, même nom) — prévenus après
  // coup qu'ils aient explicitement demandé la certification ou juste
  // utilisé le même nom sans jamais rien demander.
  const { data: lignesRaw } = await admin
    .from('categories')
    .select('beatmaker_id, beatmakers(email)')
    .eq('type', type)
    .eq('source', 'beatmaker')
    .eq('statut', 'active')
    .ilike('nom', nomGroupe)

  const { error } = await admin.rpc('traiter_groupe_certification', {
    p_type: type, p_nom_groupe: nomGroupe, p_nom_final: valeur, p_approuver: true,
  })
  if (error) return { erreur: error.message }

  type LigneJoin = { beatmaker_id: string; beatmakers: { email: string } | null }
  const destinataires = new Map<string, string>()
  for (const l of (lignesRaw ?? []) as unknown as LigneJoin[]) {
    if (l.beatmakers?.email) destinataires.set(l.beatmaker_id, l.beatmakers.email)
  }
  await Promise.all(
    [...destinataires.entries()].map(([beatmakerId, email]) =>
      envoyerCategorieCertifiee({ to: email, nomCategorie: valeur, beatmakerId }).catch(() => {})
    )
  )

  revalidatePath(CHEMIN)
  return {}
}

export async function rejeterCertificationGroupe(type: TypeCategorie, nomGroupe: string): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const admin = createAdminClient()
  const { error } = await admin.rpc('traiter_groupe_certification', {
    p_type: type, p_nom_groupe: nomGroupe, p_nom_final: '', p_approuver: false,
  })
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
