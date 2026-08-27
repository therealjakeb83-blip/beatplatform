import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id, email, nom_artiste, statement_descriptor')
    .eq('id', user.id)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Beatmaker introuvable' }, { status: 404 })

  let accountId = beatmaker.stripe_account_id

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: beatmaker.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { beatmaker_id: user.id },
      // Repris s'il a déjà été choisi avant la connexion du compte (voir
      // /api/stripe/statement-descriptor, qui le pousse directement sur les
      // comptes déjà connectés — ici on couvre le cas inverse).
      ...(beatmaker.statement_descriptor
        ? { settings: { payments: { statement_descriptor: beatmaker.statement_descriptor } } }
        : {}),
    })
    accountId = account.id

    await supabase
      .from('beatmakers')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id)
  }

  // Lier les beat_splits en attente par email_invite dès la connexion Stripe
  await supabase
    .from('beat_splits')
    .update({ beatmaker_id: user.id, statut: 'actif', email_invite: null })
    .eq('email_invite', beatmaker.email)
    .is('beatmaker_id', null)

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  // Wallets en Direct Charge (Phase 2) — l'enregistrement de domaine fait
  // sur le compte plateforme ne vaut QUE pour ce compte, jamais pour les
  // comptes connectés : chaque compte connecté doit enregistrer le domaine
  // séparément pour qu'Apple Pay/Google Pay fonctionnent une fois le
  // paiement créé avec {stripeAccount}. Découvert en testant Direct Charge
  // le 2026-08-27 : le bouton Apple Pay apparaissait (`applePayDomains`,
  // API historique) mais le paiement restait bloqué en "Traitement en
  // cours" indéfiniment sans jamais déclencher `onConfirm` côté client —
  // cause réelle trouvée dans la doc Stripe (section Connect de
  // /elements/express-checkout-element/accept-a-payment) : Express
  // Checkout Element vérifie la nouvelle API unifiée `PaymentMethodDomain`,
  // pas l'ancienne API Apple Pay-only. Toujours ré-exécuté (pas juste à la
  // création) pour rattraper les comptes déjà connectés avant ce correctif
  // — idempotent, l'erreur "domaine déjà enregistré" est silencieusement
  // ignorée. Jamais tenté en local (localhost n'est pas un domaine public
  // valide).
  const hostname = new URL(origin).hostname
  if (hostname !== 'localhost') {
    try {
      const domaine = await stripe.paymentMethodDomains.create({ domain_name: hostname }, { stripeAccount: accountId })
      console.log('[connect/creer] Domaine enregistré pour', accountId, '— apple_pay:', domaine.apple_pay.status, 'google_pay:', domaine.google_pay.status)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!/already exists|already registered/i.test(message)) {
        console.error('[connect/creer] Erreur enregistrement domaine (paymentMethodDomains):', message)
      }
    }
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/paiements?refresh=true`,
    return_url: `${origin}/dashboard/paiements?connected=true`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: accountLink.url })
}
