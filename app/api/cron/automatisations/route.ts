import { createAdminClient } from '@/utils/supabase/admin'
import { traiterEvenementAutomatisation, type TypeAutomatisation } from '@/lib/automatisations'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sécurisation : Vercel injecte CRON_SECRET dans l'Authorization header
function estAutorise(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!estAutorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Le délai (configurable par recette, en minutes) est vérifié événement par
  // événement dans traiterEvenementAutomatisation — pas de filtre d'âge ici.
  const { data: evenements } = await supabase
    .from('automatisation_evenements')
    .select('id, beatmaker_id, client_id, type, reference_id, created_at')
    .eq('traite', false)

  let traites = 0
  for (const evenement of (evenements ?? []) as { id: string; beatmaker_id: string; client_id: string; type: TypeAutomatisation; reference_id: string; created_at: string }[]) {
    await traiterEvenementAutomatisation(evenement)
    traites++
  }

  console.log(`[cron] automatisations — événements passés en revue: ${traites}`)
  return NextResponse.json({ traites })
}
