'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { estAdmin } from '@/lib/admin'
import { genererApercuTransactionnelPlateforme, envoyerConditionsMiseAJour, type TypeTemplatePlateforme } from '@/lib/emails'
import { envoiAutorise } from '@/lib/email-liste-blanche'

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

const PREAVIS_CONDITIONS_JOURS = 30

// Clause d'évolution (Q10/Q10b du grill-me Phase 12) : email purement
// informatif à TOUS les beatmakers, entrée en vigueur à J+30. Le verrou
// liste blanche (lib/email-liste-blanche.ts) bloque les adresses hors
// liste tant que la plateforme n'est pas lancée.
export async function prevenirMiseAJourConditions(
  texteConcerne: string,
  resumeChangements: string,
): Promise<{ erreur?: string; envoyes?: number; bloques?: number; dateEffet?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }
  if (!texteConcerne.trim() || !resumeChangements.trim()) {
    return { erreur: 'Indique le texte concerné et ce qui change.' }
  }

  const admin = createAdminClient()
  const { data: beatmakers, error } = await admin.from('beatmakers').select('id, email').not('email', 'is', null)
  if (error) return { erreur: error.message }

  const dateEffet = new Date(Date.now() + PREAVIS_CONDITIONS_JOURS * 24 * 60 * 60 * 1000).toISOString()
  let envoyes = 0
  let bloques = 0
  for (const bm of (beatmakers ?? []) as { id: string; email: string }[]) {
    if (envoiAutorise(bm.email)) envoyes++
    else bloques++
    await envoyerConditionsMiseAJour({
      to: bm.email,
      beatmakerId: bm.id,
      texteConcerne: texteConcerne.trim(),
      resumeChangements: resumeChangements.trim(),
      dateEffet,
    })
  }
  return { envoyes, bloques, dateEffet }
}
