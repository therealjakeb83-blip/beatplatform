import { stripe } from '@/lib/stripe'
import { creerCompteVendeur } from '@/lib/stripe-comptes'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { paiementsDisponiblesDans, PAYS_PAR_DEFAUT, MESSAGE_PAIEMENTS_INDISPONIBLES } from '@/lib/pays'

// Code d'activité Stripe « Digital Goods: Media, Books, Movies, Music ».
const MCC_MUSIQUE_NUMERIQUE = '5815'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id, email, nom_artiste, slug, statement_descriptor, pays')
    .eq('id', user.id)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Beatmaker introuvable' }, { status: 404 })

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'
  let accountId = beatmaker.stripe_account_id

  if (!accountId) {
    // Pays choisi par le beatmaker (Phase 12 lot 4, Q6b) — plus de 'FR' en dur.
    const pays = beatmaker.pays || PAYS_PAR_DEFAUT
    if (!paiementsDisponiblesDans(pays)) {
      return NextResponse.json({ erreur: MESSAGE_PAIEMENTS_INDISPONIBLES }, { status: 400 })
    }

    // Pré-remplissage simple de l'onboarding Stripe (lot 4) : uniquement des
    // infos de configuration, jamais d'identité (nom, adresse, date de
    // naissance) — celles-là exigent un jeton de compte pour une plateforme
    // française. Le beatmaker confirme ou modifie tout chez Stripe.
    const urlBoutique = new URL(origin).hostname === 'localhost' ? undefined : `${origin}/${beatmaker.slug}`
    let account
    try {
      const { compte, dashboard } = await creerCompteVendeur({
        country: pays,
        email: beatmaker.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: beatmaker.nom_artiste ?? undefined,
          mcc: MCC_MUSIQUE_NUMERIQUE,
          product_description: 'Vente en ligne de licences de beats (musique instrumentale) sous forme de fichiers numériques.',
          ...(urlBoutique ? { url: urlBoutique } : {}),
        },
        metadata: { beatmaker_id: user.id },
        // Repris s'il a déjà été choisi avant la connexion du compte (voir
        // /api/stripe/statement-descriptor, qui le pousse directement sur les
        // comptes déjà connectés — ici on couvre le cas inverse).
        ...(beatmaker.statement_descriptor
          ? { settings: { payments: { statement_descriptor: beatmaker.statement_descriptor } } }
          : {}),
      })
      account = compte
      console.log('[connect/creer] Compte', compte.id, 'créé — Stripe responsable des soldes négatifs, Dashboard', dashboard)
    } catch (err) {
      console.error('[connect/creer] Création du compte Stripe refusée pour', pays, ':', err instanceof Error ? err.message : err)
      return NextResponse.json({ erreur: MESSAGE_PAIEMENTS_INDISPONIBLES }, { status: 400 })
    }
    accountId = account.id

    await supabase
      .from('beatmakers')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id)
  }

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
