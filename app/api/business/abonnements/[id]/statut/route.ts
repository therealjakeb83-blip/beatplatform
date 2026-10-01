import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'
import { optionsCompteAbonnement } from '@/lib/abonnement-boutique'
import { NextRequest, NextResponse } from 'next/server'

// « Marquer comme actif » retiré (lot 2 du 2026-10-01, décision de Jake) :
// c'est Stripe qui sait si un impayé a finalement été payé, le statut suit
// tout seul par le webhook.
type Action = 'annuler' | 'reactiver' | 'annuler_impaye'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { action }: { action: Action } = await req.json()

  const admin = createAdminClient()

  const { data: abo } = await admin
    .from('abonnements_boutique')
    .select('id, statut, annulation_en_cours, stripe_subscription_id, stripe_account_id')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!abo) return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })

  // Abonnement en paiement direct : il vit sur le compte Stripe du beatmaker.
  const options = optionsCompteAbonnement(abo.stripe_account_id)
  let update: Record<string, unknown>

  try {
    switch (action) {
      case 'annuler':
        if (abo.statut !== 'actif' || abo.annulation_en_cours) {
          return NextResponse.json({ error: 'Action non valide pour ce statut' }, { status: 400 })
        }
        // Stripe : annuler à la fin de la période en cours
        if (abo.stripe_subscription_id) {
          await stripe.subscriptions.update(abo.stripe_subscription_id, { cancel_at_period_end: true }, options)
        }
        update = { annulation_en_cours: true, date_annulation: new Date().toISOString() }
        break

      case 'reactiver':
        if (!abo.annulation_en_cours) {
          return NextResponse.json({ error: 'Action non valide pour ce statut' }, { status: 400 })
        }
        // Stripe : annuler la demande d'annulation
        if (abo.stripe_subscription_id) {
          await stripe.subscriptions.update(abo.stripe_subscription_id, { cancel_at_period_end: false }, options)
        }
        update = { annulation_en_cours: false, date_annulation: null }
        break

      case 'annuler_impaye':
        if (abo.statut !== 'impaye') {
          return NextResponse.json({ error: 'Action non valide pour ce statut' }, { status: 400 })
        }
        // Stripe : annuler immédiatement si subscription existe
        if (abo.stripe_subscription_id) {
          await stripe.subscriptions.cancel(abo.stripe_subscription_id, {}, options)
        }
        update = { statut: 'annule', date_annulation: new Date().toISOString() }
        break

      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
    }
  } catch (err) {
    console.error('[abonnements/statut] Erreur Stripe:', action, abo.id, err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Stripe n\'a pas pu enregistrer ce changement, rien n\'a été modifié. Réessaie dans quelques instants.' }, { status: 502 })
  }

  const { error } = await admin
    .from('abonnements_boutique')
    .update(update)
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) {
    console.error('[abonnements/statut]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
