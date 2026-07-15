import { createAdminClient } from '@/utils/supabase/admin'
import { traiterGroupeAutomatisations, jourParisISO, type TypeAutomatisation, type EvenementAutomatisation } from '@/lib/automatisations'
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

  // Le délai (configurable par recette) est vérifié à l'intérieur de
  // traiterGroupeAutomatisations — pas de filtre d'âge ici.
  const { data: evenements } = await supabase
    .from('automatisation_evenements')
    .select('id, beatmaker_id, client_id, type, reference_id, created_at')
    .eq('traite', false)
    .limit(LIMITE_PAR_PASSAGE)

  const liste = (evenements ?? []) as { id: string; beatmaker_id: string; client_id: string; type: TypeAutomatisation; reference_id: string; created_at: string }[]

  // Regroupement par (beatmaker, client, jour calendaire Paris de
  // l'événement) — les combinaisons se raisonnent sur le jour où les
  // événements ont eu lieu, jamais événement par événement (voir
  // docs/automatisations/combinaisons-5.7.md). Un même groupe peut mélanger
  // des types différents (achat + abonnement le même jour, etc.).
  const groupes = new Map<string, EvenementAutomatisation[]>()
  for (const e of liste) {
    const cle = `${e.beatmaker_id}:${e.client_id}:${jourParisISO(e.created_at)}`
    const arr = groupes.get(cle) ?? []
    arr.push(e)
    groupes.set(cle, arr)
  }

  const listeGroupes = [...groupes.values()]
  let groupesTraites = 0
  for (let i = 0; i < listeGroupes.length; i += TAILLE_LOT_PARALLELE) {
    const lot = listeGroupes.slice(i, i + TAILLE_LOT_PARALLELE)
    await Promise.all(lot.map(groupe =>
      traiterGroupeAutomatisations(groupe).catch(err =>
        console.error('[cron] Erreur traitement groupe', groupe[0]?.client_id, ':', err)
      )
    ))
    groupesTraites += lot.length
  }

  console.log(`[cron] automatisations — événements passés en revue: ${liste.length}, groupes (client+jour): ${groupesTraites}`)
  return NextResponse.json({ evenements: liste.length, groupes: groupesTraites })
}
