import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { beatmakerImport } from '@/lib/import-externe/route-commun'

export const runtime = 'nodejs'
export const maxDuration = 60

// Annulation d'un import — possible aussi en plan Free (décision 21)
export async function POST(req: Request) {
  const acces = await beatmakerImport(false)
  if ('refus' in acces) return acces.refus
  const { importId } = await req.json().catch(() => ({}))
  if (typeof importId !== 'string') return NextResponse.json({ error: 'Import manquant.' }, { status: 400 })

  const { data, error } = await createAdminClient().rpc('annuler_import_externe', {
    p_beatmaker_id: acces.beatmakerId,
    p_import_id: importId,
  })
  if (error) {
    if (error.message?.includes('import_deja_annule')) return NextResponse.json({ error: 'Cet import est déjà annulé.' }, { status: 409 })
    if (error.message?.includes('import_introuvable')) return NextResponse.json({ error: 'Import introuvable.' }, { status: 404 })
    console.error('[imports-externes/annuler] rpc:', error)
    return NextResponse.json({ error: 'L’annulation a échoué : rien n’a été modifié.' }, { status: 500 })
  }
  return NextResponse.json({ resultat: data })
}
