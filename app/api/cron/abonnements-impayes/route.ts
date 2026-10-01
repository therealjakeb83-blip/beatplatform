import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { optionsCompteAbonnement } from '@/lib/abonnement-boutique'
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
    .select('id, stripe_subscription_id, stripe_account_id')
    .eq('statut', 'impaye')
    .lte('impaye_depuis', seuil)

  let annules = 0
  let echecs = 0
  for (const abo of expires ?? []) {
    // Jamais « annulé » chez nous tant que Stripe peut encore prélever : si
    // l'annulation échoue, l'abonnement reste impayé et la nuit suivante
    // réessaie (avant le 2026-10-01, la base passait à « annulé » quand même).
    if (abo.stripe_subscription_id && !(await annulerChezStripe(abo.stripe_subscription_id, abo.stripe_account_id, abo.id))) {
      echecs++
      continue
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

  console.log(`[cron] abonnements-impayes — annulés après ${DELAI_GRACE_JOURS}j: ${annules}, annulation Stripe en échec: ${echecs}`)
  return NextResponse.json({ annules, echecs })
}

// Vrai si l'abonnement n'est plus actif chez Stripe (annulé maintenant ou
// déjà avant), sur le compte où il vit (celui du beatmaker en paiement direct).
async function annulerChezStripe(subscriptionId: string, stripeAccountId: string | null, aboId: string): Promise<boolean> {
  const options = optionsCompteAbonnement(stripeAccountId)
  try {
    await stripe.subscriptions.cancel(subscriptionId, {}, options)
    return true
  } catch (err) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {}, options)
      if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return true
    } catch {}
    console.error('[cron] Erreur annulation Stripe abo', aboId, ':', err instanceof Error ? err.message : err)
    return false
  }
}
