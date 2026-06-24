import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

type Action = 'annuler' | 'reactiver' | 'marquer_actif' | 'annuler_impaye'

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
    .select('id, statut, annulation_en_cours, stripe_subscription_id')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!abo) return NextResponse.json({ error: 'Abonnement introuvable' }, { status: 404 })

  let update: Record<string, unknown>

  switch (action) {
    case 'annuler':
      if (abo.statut !== 'actif' || abo.annulation_en_cours) {
        return NextResponse.json({ error: 'Action non valide pour ce statut' }, { status: 400 })
      }
      // Stripe : annuler à la fin de la période en cours
      if (abo.stripe_subscription_id) {
        await stripe.subscriptions.update(abo.stripe_subscription_id, {
          cancel_at_period_end: true,
        })
      }
      update = { annulation_en_cours: true, date_annulation: new Date().toISOString() }
      break

    case 'reactiver':
      if (!abo.annulation_en_cours) {
        return NextResponse.json({ error: 'Action non valide pour ce statut' }, { status: 400 })
      }
      // Stripe : annuler la demande d'annulation
      if (abo.stripe_subscription_id) {
        await stripe.subscriptions.update(abo.stripe_subscription_id, {
          cancel_at_period_end: false,
        })
      }
      update = { annulation_en_cours: false, date_annulation: null }
      break

    case 'marquer_actif':
      if (abo.statut !== 'impaye') {
        return NextResponse.json({ error: 'Action non valide pour ce statut' }, { status: 400 })
      }
      update = { statut: 'actif' }
      break

    case 'annuler_impaye':
      if (abo.statut !== 'impaye') {
        return NextResponse.json({ error: 'Action non valide pour ce statut' }, { status: 400 })
      }
      // Stripe : annuler immédiatement si subscription existe
      if (abo.stripe_subscription_id) {
        await stripe.subscriptions.cancel(abo.stripe_subscription_id)
      }
      update = { statut: 'annule', date_annulation: new Date().toISOString() }
      break

    default:
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
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
