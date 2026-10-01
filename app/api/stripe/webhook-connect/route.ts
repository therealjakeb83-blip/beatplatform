import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { traiterPaiementExpress } from '@/lib/webhook-paiement'
import { enregistrerLitige, traiterLitigeMisAJour, cloreLitige, LitigeARejouer } from '@/lib/litiges'
import { traiterMajCompteOperationnel } from '@/lib/pret-a-vendre-suivi'
import { traiterRemboursementStripe } from '@/lib/remboursement'
import {
  EvenementARejouer, traiterAnnulationAbonnementBoutique, traiterEchecFactureCompteVendeur, traiterFacturePayeeCompteVendeur, traiterMajAbonnementBoutique,
} from '@/lib/abonnement-boutique-webhook'
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
// Ventes (payment_intent.succeeded scopé achat_express) et, depuis le
// 2026-10-01, abonnements boutique en paiement direct (invoice.*,
// customer.subscription.*).
//
// + litiges Stripe (charge.dispute.created/updated/closed) — voir
// lib/litiges.ts. Ces events doivent être cochés si jamais ce endpoint est
// reconfiguré depuis zéro (created/closed activés via l'API le 2026-08-31,
// updated au lot 4b de la Phase 13).
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

    // checkout.session.completed en mode 'payment' n'arrive plus jamais ici
    // depuis le passage à la page de paiement custom (Phase 9) — plus aucune
    // Checkout Session créée pour un achat de beat, seul le PaymentIntent
    // (payment_intent.succeeded ci-dessous) reste utilisé.

    // Même garde que le webhook plateforme : scopé metadata.type==='achat_express'
    // pour ne jamais retraiter un PaymentIntent interne d'une Checkout Session
    // déjà traitée par checkout.session.completed.
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      if (paymentIntent.metadata?.type === 'achat_express') {
        await traiterPaiementExpress(paymentIntent, stripeAccountId)
      }
    }

    // Compte vendeur devenu opérationnel ou suspendu (onboarding, contrôle
    // Stripe…) — n'arrive QUE sur cet endpoint, jamais sur le webhook
    // plateforme. Event à cocher sur cet endpoint (.scratch/phase13-abonner-account-updated.mjs).
    if (event.type === 'account.updated') {
      await traiterMajCompteOperationnel(event.data.object as Stripe.Account)
    }

    // Remboursements (Phase 13, lot 4a) : ceux faits par un vendeur depuis son
    // espace Stripe font tomber la licence (avoir, fichiers fermés) ; ceux
    // lancés par la plateforme ne sont suivis que s'ils échouent après coup.
    // Events à cocher sur cet endpoint (.scratch/phase13-lot4-abonner-refunds.mjs).
    if (event.type === 'refund.created' || event.type === 'refund.updated' || event.type === 'refund.failed') {
      await traiterRemboursementStripe(event.data.object as Stripe.Refund, stripeAccountId)
    }

    // Litiges (Phase 13, lot 4b, lib/litiges.ts) : détectés par part (solo
    // ou collab), A répond depuis la fiche commande. charge.dispute.updated
    // (réponse envoyée par un vendeur depuis Stripe) est à cocher sur cet
    // endpoint (.scratch/phase13-lot4b-abonner-litiges.mjs).
    if (event.type === 'charge.dispute.created') {
      await enregistrerLitige(event.data.object as Stripe.Dispute, stripeAccountId)
    }

    if (event.type === 'charge.dispute.updated') {
      await traiterLitigeMisAJour(event.data.object as Stripe.Dispute, stripeAccountId)
    }

    if (event.type === 'charge.dispute.closed') {
      await cloreLitige(event.data.object as Stripe.Dispute, stripeAccountId)
    }

    // Abonnements boutique en paiement direct (2026-10-01,
    // lib/abonnement-boutique-webhook.ts) : l'abonnement est enregistré à la
    // 1re facture payée (invoice.paid couvre aussi une 1re facture à 0 €).
    // Events à cocher sur cet endpoint (.scratch/abo-direct-abonner-events.mjs).
    if (event.type === 'invoice.paid') {
      await traiterFacturePayeeCompteVendeur(event.data.object as Stripe.Invoice, stripeAccountId)
    }

    if (event.type === 'invoice.payment_failed') {
      await traiterEchecFactureCompteVendeur(event.data.object as Stripe.Invoice)
    }

    if (event.type === 'customer.subscription.updated') {
      await traiterMajAbonnementBoutique(event.data.object as Stripe.Subscription)
    }

    if (event.type === 'customer.subscription.deleted') {
      await traiterAnnulationAbonnementBoutique(event.data.object as Stripe.Subscription)
    }
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err)
    console.error('[webhook-connect] Erreur traitement event', event.type, ':', erreur)
    await logAdmin.from('stripe_events').update({ statut: 'echoue', erreur, traite_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
    // Litige arrivé avant sa commande : Stripe renverra l'événement plus tard.
    if (err instanceof LitigeARejouer || err instanceof EvenementARejouer) return NextResponse.json({ erreur }, { status: 500 })
    // 200 quand même : la signature est valide, l'erreur vient de notre
    // traitement — répondre en erreur ferait retenter Stripe indéfiniment
    // le même event.
    return NextResponse.json({ ok: true })
  }

  await logAdmin.from('stripe_events').update({ statut: 'traite', traite_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
  return NextResponse.json({ ok: true })
}
