import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { COLONNES_ECOUTE, beatVisible, estAbonneBoutique, lienEcoute, type BeatEcoute } from '@/lib/ecoute'
import { UUID_BEAT } from '@/lib/fichiers-beat'

export const runtime = 'nodejs'

// Rang 9f, Lot 1 (décision 2) : renouvelle le lien d'écoute d'un beat quand
// celui préparé avec la page a expiré (le lecteur reprend tout seul, sans
// recharger). Mêmes règles que l'affichage : public, ou privé pour un abonné.
export async function POST(request: Request) {
  const { beatId } = await request.json().catch(() => ({})) as { beatId?: string }
  if (!beatId || !UUID_BEAT.test(beatId)) return NextResponse.json({ erreur: 'Beat invalide' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('beats').select(COLONNES_ECOUTE).eq('id', beatId).maybeSingle()
  const beat = data as BeatEcoute | null
  if (!beat) return NextResponse.json({ erreur: 'Indisponible' }, { status: 404 })

  let estAbonne = false
  if (beat.statut === 'prive') {
    const { data: bm } = await admin.from('beatmakers').select('slug').eq('id', beat.beatmaker_id).maybeSingle()
    estAbonne = !!bm?.slug && await estAbonneBoutique(beat.beatmaker_id, bm.slug)
  }
  const url = beatVisible(beat, estAbonne) ? await lienEcoute(beat) : null
  if (!url) return NextResponse.json({ erreur: 'Indisponible' }, { status: 403 })
  return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
}
