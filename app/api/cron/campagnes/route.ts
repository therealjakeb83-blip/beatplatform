import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerCampagne } from '@/lib/mailing'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sécurisation : Vercel injecte CRON_SECRET dans l'Authorization header
function estAutorise(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

// Traite les campagnes planifiées dont l'heure d'envoi est passée.
// Tourne une fois par jour (cf vercel.json) — une campagne "planifiée à 10h"
// part donc au prochain passage du cron, pas à la minute près.
export async function GET(request: Request) {
  if (!estAutorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: aEnvoyer } = await supabase
    .from('campagnes')
    .select('id')
    .eq('statut', 'planifiee')
    .lte('scheduled_at', new Date().toISOString())

  let envoyees = 0
  for (const c of aEnvoyer ?? []) {
    try {
      await envoyerCampagne(c.id)
      envoyees++
    } catch (err) {
      console.error('[cron] Erreur envoi campagne', c.id, ':', err)
    }
  }

  console.log(`[cron] campagnes — envoyées: ${envoyees}`)
  return NextResponse.json({ envoyees })
}
