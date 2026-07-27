'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { estAdmin } from '@/lib/admin'
import { genererApercuTransactionnelPlateforme, type TypeTemplatePlateforme } from '@/lib/emails'

const CHEMIN = '/dashboard/admin/mails-plateforme'

export async function sauvegarderTemplatePlateforme(type: TypeTemplatePlateforme, titre: string, intro: string): Promise<{ erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const admin = createAdminClient()
  const { error } = await admin.from('templates_plateforme').upsert(
    { type, titre: titre.trim() || null, intro: intro.trim() || null, updated_at: new Date().toISOString() },
    { onConflict: 'type' },
  )
  if (error) return { erreur: error.message }

  revalidatePath(CHEMIN)
  return {}
}

export async function genererApercuPlateforme(type: TypeTemplatePlateforme, titreDraft: string, introDraft: string): Promise<string> {
  if (!(await estAdmin())) return ''
  return genererApercuTransactionnelPlateforme(type, titreDraft, introDraft)
}
