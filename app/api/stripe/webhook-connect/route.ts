import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { traiterPaiement, traiterPaiementExpress } from '@/lib/webhook-paiement'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Endpoint dédié aux events des comptes Stripe Connect (Direct Charge,
// Phase 2) — distinct du webhook plateforme (app/api/stripe/webhook/route.ts).
// Nécessaire car en Direct Charge la Checkout Session/le PaymentIntent est
// créé DIRECTEMENT sur le compte connecté (`{stripeAccount: id}`) : les
// events correspondants (checkout.session.completed, payment_intent.succeeded)
// n'arrivent jamais sur le webhook plateforme, qui ne reçoit que les events
// platform-level. À configurer côté Dashboard Stripe : Développeurs →
// Webhooks → "+ Ajouter un endpoint" → cocher "Écouter les événements sur
// les comptes connectés" → même URL que celle-ci → secret distinct
// (STRIPE_WEBHOOK_CONNECT_SECRET, jamais le même que STRIPE_WEBHOOK_SECRET).
//
// Scope volontairement réduit à la vente (checkout.session.completed en
// mode 'payment', payment_intent.succeeded scopé achat_express) — les
// abonnements et les splits collab ne passent jamais par ce chemin (ils
// restent sur l'ancien modèle, voir plan Phase 2).
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ erreur: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_CONNECT_SECRET!
    )
  } catch {
    return NextResponse.json({ erreur: 'Signature invalide' }, { status: 400 })
  }

  // event.account = le compte connecté d'origine, toujours présent sur un
  // event Connect — absent uniquement si ce endpoint reçoit par erreur un
  // event platform-level (mauvaise config Dashboard), auquel cas on
  // n'accepte pas de le traiter comme une vente Direct Charge.
  const stripeAccountId = event.account ?? null

  const logAdmin = createAdminClient()
  await logAdmin.from('stripe_events').upsert(
    { stripe_event_id: event.id, type: event.type, statut: 'recu', compte_connecte: stripeAccountId },
    { onConflict: 'stripe_event_id' }
  )

  try {
    if (!stripeAccountId) {
      throw new Error('Event reçu sans compte connecté associé — vérifier la config du endpoint côté Dashboard Stripe')
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'payment') {
        await traiterPaiement(session, stripeAccountId)
      }
      // mode 'subscription' : jamais attendu ici, les abonnements restent
      // sur l'ancien modèle (transfer_data), pas sur le compte connecté.
    }

    // Même garde que le webhook plateforme : scopé metadata.type==='achat_express'
    // pour ne jamais retraiter un PaymentIntent interne d'une Checkout Session
    // déjà traitée par checkout.session.completed.
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      if (paymentIntent.metadata?.type === 'achat_express') {
        await traiterPaiementExpress(paymentIntent, stripeAccountId)
      }
    }
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err)
    console.error('[webhook-connect] Erreur traitement event', event.type, ':', erreur)
    await logAdmin.from('stripe_events').update({ statut: 'echoue', erreur, traite_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
    // 200 quand même : la signature est valide, l'erreur vient de notre
    // traitement — répondre en erreur ferait retenter Stripe indéfiniment
    // le même event.
    return NextResponse.json({ ok: true })
  }

  await logAdmin.from('stripe_events').update({ statut: 'traite', traite_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
  return NextResponse.json({ ok: true })
}
