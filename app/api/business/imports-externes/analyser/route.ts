import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { preparerImport, ErreurImport } from '@/lib/import-externe/preparation'
import { ErreurTauxBce } from '@/lib/import-externe/taux-bce'
import { beatmakerImport, lireFichierRequete } from '@/lib/import-externe/route-commun'

export const runtime = 'nodejs'
export const maxDuration = 60

// Écran de vérification : lit le fichier et calcule l'aperçu, n'écrit RIEN.
export async function POST(req: Request) {
  const acces = await beatmakerImport(true)
  if ('refus' in acces) return acces.refus
  const fichier = await lireFichierRequete(req)
  if ('refus' in fichier) return fichier.refus

  try {
    const { apercu } = await preparerImport(createAdminClient(), acces.beatmakerId, fichier.texte, fichier.nom)
    return NextResponse.json({ apercu })
  } catch (e) {
    if (e instanceof ErreurImport || e instanceof ErreurTauxBce) return NextResponse.json({ error: e.message }, { status: 422 })
    console.error('[imports-externes/analyser]', e)
    return NextResponse.json({ error: 'Lecture du fichier impossible.' }, { status: 500 })
  }
}
