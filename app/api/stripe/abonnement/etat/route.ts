import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerAbonnementGratuitDepuisCarte } from '@/lib/abonnement-boutique'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Etat =
  | { etat: 'termine'; subscription_id: string }
  | { etat: 'en_cours' }
  | { etat: 'interrompu' }
  | { etat: 'abandonne' }

// Où en est un abonnement en train d'être payé ? Sert à l'attente après le
// paiement (l'abonnement est enregistré par le webhook) et après un
// rechargement de la page pendant le paiement : jamais de 2e abonnement pour
// un paiement déjà parti. Seul l'onglet d'origine demande l'annulation
// (annuler: true) d'un paiement interrompu, comme pour les licences.
export async function POST(request: Request) {
  const { slug, id, annuler } = await request.json() as { slug?: string; id?: string; annuler?: boolean }
  if (!slug || !id || !(id.startsWith('sub_') || id.startsWith('seti_'))) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: beatmaker } = await admin.from('beatmakers').select('stripe_account_id').eq('slug', slug).maybeSingle()
  if (!beatmaker?.stripe_account_id) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })
  const stripeAccount = beatmaker.stripe_account_id as string

  try {
    let subscriptionId = id
    if (id.startsWith('seti_')) {
      const setupIntent = await stripe.setupIntents.retrieve(id, {}, { stripeAccount })
      if (setupIntent.metadata?.slug !== slug) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
      if (setupIntent.status === 'canceled') return NextResponse.json({ etat: 'abandonne' } satisfies Etat)
      if (setupIntent.status !== 'succeeded') {
        if (!annuler) return NextResponse.json({ etat: 'interrompu' } satisfies Etat)
        await stripe.setupIntents.cancel(id, {}, { stripeAccount })
        return NextResponse.json({ etat: 'abandonne' } satisfies Etat)
      }
      // Carte enregistrée mais page fermée avant la création : on la termine.
      subscriptionId = await creerAbonnementGratuitDepuisCarte(stripeAccount, setupIntent)
    }

    const { data: abonnement } = await admin.from('abonnements_boutique').select('id').eq('stripe_subscription_id', subscriptionId).maybeSingle()
    if (abonnement) return NextResponse.json({ etat: 'termine', subscription_id: subscriptionId } satisfies Etat)

    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] }, { stripeAccount })
    if (sub.metadata?.slug !== slug) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
    if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
      return NextResponse.json({ etat: 'en_cours' } satisfies Etat)
    }
    if (sub.status !== 'incomplete') return NextResponse.json({ etat: 'abandonne' } satisfies Etat)

    const facture = sub.latest_invoice as Stripe.Invoice | null
    if (facture?.status === 'paid') return NextResponse.json({ etat: 'en_cours' } satisfies Etat)
    if (!annuler) return NextResponse.json({ etat: 'interrompu' } satisfies Etat)
    await stripe.subscriptions.cancel(subscriptionId, {}, { stripeAccount })
    return NextResponse.json({ etat: 'abandonne' } satisfies Etat)
  } catch (err) {
    // Annulation refusée = il vient d'aboutir : le webhook termine.
    console.error('[abonnement/etat]', id, err instanceof Error ? err.message : err)
    return NextResponse.json({ etat: 'en_cours' } satisfies Etat)
  }
}
