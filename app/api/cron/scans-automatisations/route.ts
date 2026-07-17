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

// Relance inactivité n'a pas de déclencheur ponctuel (webhook/route) —
// contrairement aux autres recettes, elle dépend d'un scan périodique.
// Route dédiée (plutôt qu'ajoutée à /api/cron/automatisations) pour garder un
// nom générique — prête à accueillir un futur workflow du même genre sans
// multiplier les entrées dans vercel.json (limite du plan Vercel).
export async function GET(request: Request) {
  if (!estAutorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const relances = await scannerRelanceInactivite(admin)

  console.log(`[cron] scans-automatisations — relance_inactivite: ${relances}`)
  return NextResponse.json({ relance_inactivite: relances })
}

// Pour chaque beatmaker ayant activé la recette : dernière activité par
// client, relance si elle date de plus de X mois (config.mois_inactivite,
// défaut 3). reference_id = id de cette dernière commande — la contrainte
// UNIQUE(type, reference_id) empêche de relancer deux fois pour la même
// commande ; un nouvel achat fait naturellement repartir le compteur puisque
// la "dernière commande" change.
//
// Correctif 5.7 (docs/automatisations/combinaisons-5.7.md) : "dernière
// activité" inclut désormais aussi les paiements d'abonnement réussis
// (CREATION_ABONNEMENT / RENOUVELLEMENT — déjà présents dans `commandes`,
// écrits par le webhook Stripe à chaque mensualité), pas seulement les achats
// LICENCE. Avant ce correctif, un abonné qui payait fidèlement chaque mois
// sans jamais acheter de licence à l'unité se faisait quand même flaguer
// "inactif" et recevait un code promo — absurde pour quelqu'un qui paie déjà.
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
      .in('type_commande', ['LICENCE', 'CREATION_ABONNEMENT', 'RENOUVELLEMENT'])
      .not('client_id', 'is', null)
      .order('created_at', { ascending: false })

    const derniereParClient = new Map<string, { id: string; created_at: string }>()
    for (const c of commandes ?? []) {
      const clientId = c.client_id as string
      if (!derniereParClient.has(clientId)) derniereParClient.set(clientId, { id: c.id, created_at: c.created_at })
    }

    // Anti-spam : ne jamais relancer 2 fois pour la même "dernière commande"
    // — indépendant du statut traité de l'événement. La contrainte DB
    // (index unique partiel, "sauf si déjà traité") suffit pour
    // abonnement_en_attente/churn (référence = un abonnement qui peut
    // légitimement repasser par le même état) mais PAS ici : tant que le
    // client reste inactif, sa "dernière commande" ne change jamais — sans
    // ce filtre, le mail traité de la veille libère la contrainte et le scan
    // du lendemain le redéposerait, un envoi par jour à l'infini (bug
    // découvert avec Jake, 2026-07-16, juste après avoir posé l'index
    // partiel pour un autre besoin).
    const { data: dejaRelances } = await admin
      .from('automatisation_evenements')
      .select('reference_id')
      .eq('beatmaker_id', auto.beatmaker_id)
      .eq('type', 'relance_inactivite')
    const referencesDejaRelancees = new Set((dejaRelances ?? []).map(e => e.reference_id))

    for (const [clientId, derniere] of derniereParClient) {
      if (new Date(derniere.created_at) > seuil) continue // encore actif
      if (referencesDejaRelancees.has(derniere.id)) continue // déjà relancé pour cette même dernière commande

      const { error } = await admin.from('automatisation_evenements').insert({
        beatmaker_id: auto.beatmaker_id,
        client_id: clientId,
        type: 'relance_inactivite',
        reference_id: derniere.id,
      })
      if (!error) deposes++
    }
  }

  return deposes
}
