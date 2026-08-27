import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreRemiseAbonne, validerCodePromo, calculerLignesPanier, resoudreClientId, type ItemPanier } from '@/lib/pricing'
import { NextResponse } from 'next/server'

// Paiement express (Apple Pay/Google Pay/PayPal) — soit un achat unitaire
// depuis la popup licence (beat_id/licence_id), soit tout le panier depuis
// CartExpressPay (items[]) ; les deux convergent vers la même liste `items`.
// Le prix n'est jamais accepté depuis le front : recalculé ici via les mêmes
// fonctions que /api/stripe/checkout (dont la réduction par lot, déjà gérée
// par calculerLignesPanier). Crée un PaymentIntent (pas une Checkout Session)
// car l'ExpressCheckoutElement a besoin d'un client_secret prêt à confirmer
// dès le clic — voir supabase/express_checkout.sql pour le détail du choix.
export async function POST(request: Request) {
  const body = await request.json() as {
    beat_id?: string
    licence_id?: string
    items?: ItemPanier[]
    slug?: string
    code_promo?: string
    email_acheteur?: string
    source_marketing?: string
  }
  const { slug, code_promo, email_acheteur, source_marketing } = body

  const items: ItemPanier[] = body.items?.length
    ? body.items
    : (body.beat_id && body.licence_id ? [{ beat_id: body.beat_id, licence_id: body.licence_id }] : [])

  if (!slug || !items.length) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: beatmakerRow } = await supabase
    .from('beatmakers')
    .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct, direct_charge_actif')
    .eq('slug', slug)
    .single()

  type BeatmakerRow = { id: string; stripe_account_id: string | null; tva_active: boolean; tva_taux: number | null; abo_remise_pct: number | null; abo_actif: boolean; direct_charge_actif: boolean }
  let beatmaker = beatmakerRow as BeatmakerRow | null

  const admin = createAdminClient()

  if (!beatmaker) {
    const { data: bm } = await admin
      .from('beatmakers')
      .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct, direct_charge_actif')
      .eq('slug', slug)
      .single()
    beatmaker = bm as BeatmakerRow | null
  }

  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  const remisePct = await resoudreRemiseAbonne(admin, beatmaker, user, slug)

  const promoResult = await validerCodePromo(admin, beatmaker, code_promo, user, email_acheteur)
  if (!promoResult.ok) return NextResponse.json({ erreur: promoResult.erreur }, { status: promoResult.status })
  const promo = promoResult.value?.promo ?? null
  const codePromoValide = promoResult.value?.codePromoValide ?? null

  const lignesResult = await calculerLignesPanier(admin, beatmaker, items, { remisePct, promo })
  if (!lignesResult.ok) return NextResponse.json({ erreur: lignesResult.erreur }, { status: lignesResult.status })
  const lignes = lignesResult.value
  const totalCents = lignes.reduce((s, l) => s + l.prixTotalCents, 0)

  if (totalCents < 50) {
    // Minimum Stripe (0,50 €) — improbable pour un panier mais on l'écarte proprement.
    return NextResponse.json({ erreur: 'Montant trop faible pour un paiement express' }, { status: 400 })
  }

  // Répartition des fonds — même logique que /api/stripe/checkout : dès qu'un
  // article du panier a des splits, toute la session bascule en mode "fonds
  // retenus + transferts manuels par article" (voir finaliserCommandePayee).
  const beatIds = [...new Set(items.map(i => i.beat_id))]
  const { data: splitsData } = await admin
    .from('beat_splits')
    .select('beat_id')
    .in('beat_id', beatIds)
  const hasSplits = (splitsData?.length ?? 0) > 0

  const paymentIntentParams: import('stripe').default.PaymentIntentCreateParams = {
    amount: totalCents,
    currency: 'eur',
    automatic_payment_methods: { enabled: true },
    receipt_email: user?.email ?? email_acheteur ?? undefined,
    metadata: {
      type: 'achat_express',
      beatmaker_id: String(beatmaker.id),
      slug,
      source_marketing: source_marketing ?? 'direct',
      ...(codePromoValide ? { code_promo: codePromoValide } : {}),
    },
  }

  // Même règle que /api/stripe/checkout : Direct Charge seulement hors split
  // et boutique explicitement basculée.
  const directChargeActif = !hasSplits && beatmaker.direct_charge_actif && !!beatmaker.stripe_account_id

  if (hasSplits) {
    paymentIntentParams.transfer_group = crypto.randomUUID()
    paymentIntentParams.metadata = { ...paymentIntentParams.metadata, has_splits: 'true' }
  } else if (!directChargeActif && beatmaker.stripe_account_id) {
    // Ancien flux (destination charge) — inchangé tant que direct_charge_actif
    // n'est pas activé pour cette boutique.
    paymentIntentParams.application_fee_amount = 0
    paymentIntentParams.on_behalf_of = beatmaker.stripe_account_id
    paymentIntentParams.transfer_data = { destination: beatmaker.stripe_account_id }
  }

  // Direct Charge : le PaymentIntent est créé directement sur le compte
  // connecté (options `stripeAccount`) — jamais application_fee_amount/
  // on_behalf_of/transfer_data sur ce mode.
  const paymentIntent = directChargeActif
    ? await stripe.paymentIntents.create(paymentIntentParams, { stripeAccount: beatmaker.stripe_account_id! })
    : await stripe.paymentIntents.create(paymentIntentParams)
  const clientId = await resoudreClientId(admin, user)

  const { data: tentative, error: tentativeError } = await admin.from('tentatives_paiement').insert({
    type: 'achat_express',
    beatmaker_id: beatmaker.id,
    client_id: clientId,
    email: user?.email ?? email_acheteur ?? null,
    prix: totalCents / 100,
    code_promo: codePromoValide,
    source_marketing: source_marketing ?? 'direct',
    stripe_payment_intent_id: paymentIntent.id,
    statut: 'creee',
  }).select('id').single()

  if (tentativeError) {
    console.error('[express-checkout] Erreur insert tentative_paiement:', JSON.stringify(tentativeError))
  } else if (tentative) {
    const { error: ligneError } = await admin.from('tentatives_paiement_lignes').insert(
      lignes.map(l => ({
        tentative_id: tentative.id,
        beat_id: l.beat_id,
        licence_id: l.licence_id,
        prix: l.prixTotalCents / 100,
        reduction_montant: l.reductionCodeCents / 100,
        code_promo_applique: l.codePromoApplique,
        reduction_lot_id: l.reductionLotId,
      }))
    )
    if (ligneError) console.error('[express-checkout] Erreur insert tentatives_paiement_lignes:', JSON.stringify(ligneError))
  }

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
