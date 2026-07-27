'use server'

import { estAdmin } from '@/lib/admin'
import { renvoyerEmail } from '@/lib/admin-mails'

// Pas de revalidatePath() — même leçon que app/dashboard/admin/boutiques/[id]/_lib/actions.ts :
// le composant client affiche déjà son propre résultat de façon optimiste,
// forcer une resynchronisation effacerait le message juste après son affichage.
export async function renvoyerEmailAction(logId: string): Promise<{ ok?: boolean; erreur?: string }> {
  if (!(await estAdmin())) return { erreur: 'Non autorisé.' }

  const resultat = await renvoyerEmail(logId)
  if (!resultat.ok) return { erreur: resultat.erreur }
  return { ok: true }
}
