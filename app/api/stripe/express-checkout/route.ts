import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreRemiseAbonne, validerCodePromo, calculerLignesPanier } from '@/lib/pricing'
import { NextResponse } from 'next/server'

// Paiement express (Apple Pay/Google Pay/PayPal) depuis la popup licence —
// achat unitaire (1 beat + 1 licence), indépendant du panier. Le prix n'est
// jamais accepté depuis le front : recalculé ici via les mêmes fonctions que
// /api/stripe/checkout. Crée un PaymentIntent (pas une Checkout Session) car
// l'ExpressCheckoutElement a besoin d'un client_secret prêt à confirmer dès
// le clic — voir supabase/express_checkout.sql pour le détail du choix.
export async function POST(request: Request) {
  const { beat_id, licence_id, slug, code_promo, email_acheteur, source_marketing } = await request.json() as {
    beat_id?: string
    licence_id?: string
    slug?: string
    code_promo?: string
    email_acheteur?: string
    source_marketing?: string
  }

  if (!slug || !beat_id || !licence_id) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: beatmakerRow } = await supabase
    .from('beatmakers')
    .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct')
    .eq('slug', slug)
    .single()

  type BeatmakerRow = { id: string; stripe_account_id: string | null; tva_active: boolean; tva_taux: number | null; abo_remise_pct: number | null; abo_actif: boolean }
  let beatmaker = beatmakerRow as BeatmakerRow | null

  const admin = createAdminClient()

  if (!beatmaker) {
    const { data: bm } = await admin
      .from('beatmakers')
      .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct')
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

  const lignesResult = await calculerLignesPanier(admin, beatmaker, [{ beat_id, licence_id }], { remisePct, promo })
  if (!lignesResult.ok) return NextResponse.json({ erreur: lignesResult.erreur }, { status: lignesResult.status })
  const [ligne] = lignesResult.value

  if (ligne.prixTotalCents < 50) {
    // Minimum Stripe (0,50 €) — improbable pour un beat mais on l'écarte proprement.
    return NextResponse.json({ erreur: 'Montant trop faible pour un paiement express' }, { status: 400 })
  }

  // Répartition des fonds — même logique que /api/stripe/checkout (ligne unique ici).
  const { data: splitsData } = await admin
    .from('beat_splits')
    .select('beat_id')
    .eq('beat_id', beat_id)
  const hasSplits = (splitsData?.length ?? 0) > 0

  const paymentIntentParams: import('stripe').default.PaymentIntentCreateParams = {
    amount: ligne.prixTotalCents,
    currency: 'eur',
    automatic_payment_methods: { enabled: true },
    receipt_email: user?.email ?? email_acheteur ?? undefined,
    metadata: {
      type: 'achat_express',
      beatmaker_id: String(beatmaker.id),
      slug,
      beat_id,
      licence_id,
      source_marketing: source_marketing ?? 'direct',
      ...(codePromoValide ? { code_promo: codePromoValide } : {}),
    },
  }

  if (hasSplits) {
    paymentIntentParams.transfer_group = crypto.randomUUID()
    paymentIntentParams.metadata = { ...paymentIntentParams.metadata, has_splits: 'true' }
  } else if (beatmaker.stripe_account_id) {
    paymentIntentParams.application_fee_amount = 0
    paymentIntentParams.on_behalf_of = beatmaker.stripe_account_id
    paymentIntentParams.transfer_data = { destination: beatmaker.stripe_account_id }
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

  const { data: tentative, error: tentativeError } = await admin.from('tentatives_paiement').insert({
    type: 'achat_express',
    beatmaker_id: beatmaker.id,
    client_id: user?.id ?? null,
    email: user?.email ?? email_acheteur ?? null,
    prix: ligne.prixTotalCents / 100,
    code_promo: codePromoValide,
    source_marketing: source_marketing ?? 'direct',
    stripe_payment_intent_id: paymentIntent.id,
    statut: 'creee',
  }).select('id').single()

  if (tentativeError) {
    console.error('[express-checkout] Erreur insert tentative_paiement:', JSON.stringify(tentativeError))
  } else if (tentative) {
    const { error: ligneError } = await admin.from('tentatives_paiement_lignes').insert({
      tentative_id: tentative.id,
      beat_id: ligne.beat_id,
      licence_id: ligne.licence_id,
      prix: ligne.prixTotalCents / 100,
      reduction_montant: ligne.reductionCodeCents / 100,
      code_promo_applique: ligne.codePromoApplique,
    })
    if (ligneError) console.error('[express-checkout] Erreur insert tentatives_paiement_lignes:', JSON.stringify(ligneError))
  }

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
