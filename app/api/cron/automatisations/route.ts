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

// Taille des lots traités en parallèle (borne la charge simultanée sur Resend/
// Supabase) et plafond par passage (le surplus attend simplement le prochain
// passage du cron — rien n'est perdu, juste étalé) : évite qu'un pic
// d'événements (ex. plusieurs boutiques partageant la même heure cible) ne
// fasse dépasser le temps d'exécution max de la fonction.
const TAILLE_LOT_PARALLELE = 20
const LIMITE_PAR_PASSAGE = 500

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
    .limit(LIMITE_PAR_PASSAGE)

  const liste = (evenements ?? []) as { id: string; beatmaker_id: string; client_id: string; type: TypeAutomatisation; reference_id: string; created_at: string }[]

  let traites = 0
  for (let i = 0; i < liste.length; i += TAILLE_LOT_PARALLELE) {
    const lot = liste.slice(i, i + TAILLE_LOT_PARALLELE)
    await Promise.all(lot.map(evenement =>
      traiterEvenementAutomatisation(evenement).catch(err =>
        console.error('[cron] Erreur traitement événement', evenement.id, ':', err)
      )
    ))
    traites += lot.length
  }

  console.log(`[cron] automatisations — événements passés en revue: ${traites}`)
  return NextResponse.json({ traites })
}
