import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { aAccesPlanPayant } from '@/lib/acces-plan'

export const TAILLE_MAX_FICHIER = 4 * 1024 * 1024

// Beatmaker connecté (+ plan payant si demandé) ; sinon la réponse d'erreur à renvoyer
export async function beatmakerImport(exigerPlanPayant: boolean): Promise<{ beatmakerId: string } | { refus: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { refus: NextResponse.json({ error: 'Non connecté' }, { status: 401 }) }
  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).maybeSingle()
  if (!bm) return { refus: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) }
  if (exigerPlanPayant && !(await aAccesPlanPayant(supabase, user.id))) {
    return { refus: NextResponse.json({ error: 'L’import de commandes externes est réservé au plan payant (essai compris).' }, { status: 403 }) }
  }
  return { beatmakerId: user.id }
}

export async function lireFichierRequete(req: Request): Promise<{ texte: string; nom: string } | { refus: NextResponse }> {
  const form = await req.formData().catch(() => null)
  const fichier = form?.get('fichier')
  if (!(fichier instanceof File)) return { refus: NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 }) }
  if (fichier.size > TAILLE_MAX_FICHIER) return { refus: NextResponse.json({ error: 'Fichier trop lourd (4 Mo maximum).' }, { status: 400 }) }
  return { texte: await fichier.text(), nom: fichier.name }
}
