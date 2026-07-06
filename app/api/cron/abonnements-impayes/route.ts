import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sécurisation : Vercel injecte CRON_SECRET dans l'Authorization header
function estAutorise(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

// Délai de grâce : un abonnement en échec de renouvellement (impaye) reste en
// pause au maximum 1 mois avant annulation automatique — au-delà, le client
// repart de zéro (mois_consecutifs) s'il reprend un nouvel abonnement.
const DELAI_GRACE_JOURS = 30

export async function GET(request: Request) {
  if (!estAutorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const seuil = new Date(Date.now() - DELAI_GRACE_JOURS * 24 * 60 * 60 * 1000).toISOString()

  const { data: expires } = await supabase
    .from('abonnements_boutique')
    .select('id, stripe_subscription_id')
    .eq('statut', 'impaye')
    .lte('impaye_depuis', seuil)

  let annules = 0
  for (const abo of expires ?? []) {
    if (abo.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(abo.stripe_subscription_id)
      } catch (err) {
        console.error('[cron] Erreur annulation Stripe abo', abo.id, ':', err)
      }
    }

    const { error } = await supabase
      .from('abonnements_boutique')
      .update({
        statut: 'annule',
        mois_consecutifs: 0,
        impaye_depuis: null,
        date_annulation: new Date().toISOString(),
        motif_annulation: 'payment_failed',
      })
      .eq('id', abo.id)

    if (error) console.error('[cron] Erreur annulation abo', abo.id, ':', JSON.stringify(error))
    else annules++
  }

  console.log(`[cron] abonnements-impayes — annulés après ${DELAI_GRACE_JOURS}j: ${annules}`)
  return NextResponse.json({ annules })
}
