'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { genererApercuTransactionnel, type TypeTemplateTransactionnel } from '@/lib/emails'

const CHEMIN = '/dashboard/business/mailing/transactionnels'

export async function sauvegarderCouleurMarque(couleur: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const valeur = couleur.trim()
  if (valeur && !/^#[0-9a-fA-F]{6}$/.test(valeur)) return { erreur: 'Couleur invalide (format hexadécimal attendu, ex: #4f46e5).' }

  const { error } = await supabase.from('beatmakers').update({ couleur_marque: valeur || null }).eq('id', user.id)
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function sauvegarderIntro(type: TypeTemplateTransactionnel, intro: string): Promise<{ erreur?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié.' }

  const { error } = await supabase.from('templates_transactionnels').upsert(
    { beatmaker_id: user.id, type, intro: intro.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: 'beatmaker_id,type' },
  )
  if (error) return { erreur: error.message }
  revalidatePath(CHEMIN)
  return {}
}

export async function genererApercu(type: TypeTemplateTransactionnel, introDraft: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ''
  return genererApercuTransactionnel(user.id, type, introDraft)
}
