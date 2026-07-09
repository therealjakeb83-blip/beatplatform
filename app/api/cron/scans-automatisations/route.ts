import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sécurisation : Vercel injecte CRON_SECRET dans l'Authorization header
function estAutorise(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

type Admin = ReturnType<typeof createAdminClient>

// Relance inactivité et Follow-up favori n'ont pas de déclencheur ponctuel
// (webhook/route) — contrairement aux autres recettes, ils dépendent d'un
// scan périodique. Regroupés dans un seul cron pour ne pas multiplier les
// entrées dans vercel.json (limite du plan Vercel).
export async function GET(request: Request) {
  if (!estAutorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()

  const [relances, favoris] = await Promise.all([
    scannerRelanceInactivite(admin),
    scannerFollowUpFavori(admin),
  ])

  console.log(`[cron] scans-automatisations — relance_inactivite: ${relances}, follow_up_favori: ${favoris}`)
  return NextResponse.json({ relance_inactivite: relances, follow_up_favori: favoris })
}

// Pour chaque beatmaker ayant activé la recette : dernière commande LICENCE
// par client, relance si elle date de plus de X mois (config.mois_inactivite,
// défaut 3). reference_id = id de cette dernière commande — la contrainte
// UNIQUE(type, reference_id) empêche de relancer deux fois pour la même
// commande ; un nouvel achat fait naturellement repartir le compteur puisque
// la "dernière commande" change.
async function scannerRelanceInactivite(admin: Admin): Promise<number> {
  const { data: automatisationsActives } = await admin
    .from('automatisations')
    .select('beatmaker_id, config')
    .eq('type', 'relance_inactivite')
    .eq('actif', true)

  let deposes = 0

  for (const auto of automatisationsActives ?? []) {
    const moisInactivite = Number((auto.config as Record<string, number> | null)?.mois_inactivite) || 3
    const seuil = new Date()
    seuil.setMonth(seuil.getMonth() - moisInactivite)

    const { data: commandes } = await admin
      .from('commandes')
      .select('id, client_id, created_at')
      .eq('beatmaker_id', auto.beatmaker_id)
      .eq('type_commande', 'LICENCE')
      .not('client_id', 'is', null)
      .order('created_at', { ascending: false })

    const derniereParClient = new Map<string, { id: string; created_at: string }>()
    for (const c of commandes ?? []) {
      const clientId = c.client_id as string
      if (!derniereParClient.has(clientId)) derniereParClient.set(clientId, { id: c.id, created_at: c.created_at })
    }

    for (const [clientId, derniere] of derniereParClient) {
      if (new Date(derniere.created_at) > seuil) continue // encore actif

      const { error } = await admin.from('automatisation_evenements').insert({
        beatmaker_id: auto.beatmaker_id,
        client_id: clientId,
        type: 'relance_inactivite',
        reference_id: derniere.id,
      })
      if (!error) deposes++
      // Erreur silencieuse attendue si déjà relancé pour cette dernière
      // commande (contrainte UNIQUE) — pas un vrai échec.
    }
  }

  return deposes
}

// Favoris ajoutés récemment (fenêtre de quelques jours — pas la peine de
// rescanner tout l'historique, un favori doit être suivi rapidement ou pas
// du tout) pour les beatmakers ayant activé la recette. reference_id = id du
// favori, dédupliqué par la même contrainte UNIQUE.
async function scannerFollowUpFavori(admin: Admin): Promise<number> {
  const { data: automatisationsActives } = await admin
    .from('automatisations')
    .select('beatmaker_id')
    .eq('type', 'follow_up_favori')
    .eq('actif', true)

  const seuil = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  let deposes = 0

  for (const auto of automatisationsActives ?? []) {
    const { data: favorisRaw } = await admin
      .from('favoris')
      .select('id, client_id, beats!inner(beatmaker_id)')
      .eq('beats.beatmaker_id', auto.beatmaker_id)
      .gte('created_at', seuil)

    const favoris = (favorisRaw ?? []) as unknown as { id: string; client_id: string }[]

    for (const favori of favoris) {
      const { error } = await admin.from('automatisation_evenements').insert({
        beatmaker_id: auto.beatmaker_id,
        client_id: favori.client_id,
        type: 'follow_up_favori',
        reference_id: favori.id,
      })
      if (!error) deposes++
    }
  }

  return deposes
}
