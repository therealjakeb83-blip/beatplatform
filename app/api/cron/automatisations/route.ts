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

  // Délai J+1 : ne traite que les événements vieux d'au moins 24h, jamais le jour même
  const seuil = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: evenements } = await supabase
    .from('automatisation_evenements')
    .select('id, beatmaker_id, client_id, type, reference_id')
    .eq('traite', false)
    .lte('created_at', seuil)

  let traites = 0
  for (const evenement of (evenements ?? []) as { id: string; beatmaker_id: string; client_id: string; type: TypeAutomatisation; reference_id: string }[]) {
    await traiterEvenementAutomatisation(evenement)
    traites++
  }

  console.log(`[cron] automatisations — événements traités: ${traites}`)
  return NextResponse.json({ traites })
}
