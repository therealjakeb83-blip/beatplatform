import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ErreurImport } from '@/lib/import-externe/preparation'
import { ErreurTauxBce } from '@/lib/import-externe/taux-bce'
import { ErreurTableau } from '@/lib/import-externe/libre/tableau'
import { ErreurAssociation } from '@/lib/import-externe/libre/association'
import { preparerFichier } from '@/lib/import-externe/entree'
import { beatmakerImport, lireFichierRequete } from '@/lib/import-externe/route-commun'

export const runtime = 'nodejs'
export const maxDuration = 60

// Écran de vérification : lit le fichier et calcule l'aperçu, n'écrit RIEN.
// Format libre sans réponses de l'assistant → renvoie de quoi lancer l'assistant.
export async function POST(req: Request) {
  const acces = await beatmakerImport(true)
  if ('refus' in acces) return acces.refus
  const fichier = await lireFichierRequete(req)
  if ('refus' in fichier) return fichier.refus

  try {
    const r = await preparerFichier(createAdminClient(), acces.beatmakerId, fichier.octets, fichier.nom, fichier.association)
    if (r.type === 'assistant') return NextResponse.json({ assistant: r.besoin })
    return NextResponse.json({ apercu: r.preparation.apercu })
  } catch (e) {
    if (e instanceof ErreurImport || e instanceof ErreurTauxBce || e instanceof ErreurTableau || e instanceof ErreurAssociation) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[imports-externes/analyser]', e)
    return NextResponse.json({ error: 'Lecture du fichier impossible.' }, { status: 500 })
  }
}
