import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { verifierTokenCampagne, COOKIE_CLIC } from '@/lib/mailing'
import { resoudreRemiseAbonne, validerCodePromo, calculerLignesPanier, resoudreClientId, type ItemPanier } from '@/lib/pricing'
import { mapperVersPaymentMethodTypes, normaliserMoyensPaiement } from '@/lib/moyens-paiement'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const { items, slug, code_promo, email_acheteur, source_marketing } = await request.json() as {
    items?: ItemPanier[]
    slug?: string
    code_promo?: string
    email_acheteur?: string
    source_marketing?: string
  }

  if (!slug || !items?.length) {
    return NextResponse.json({ erreur: 'Panier vide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: beatmakerRow } = await supabase
    .from('beatmakers')
    .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct, direct_charge_actif, moyens_paiement_acceptes')
    .eq('slug', slug)
    .single()

  type BeatmakerRow = { id: string; stripe_account_id: string | null; tva_active: boolean; tva_taux: number | null; abo_remise_pct: number | null; abo_actif: boolean; direct_charge_actif: boolean; moyens_paiement_acceptes: string[] | null }
  let beatmaker = beatmakerRow as BeatmakerRow | null

  // Fallback admin si l'artiste connecté ne peut pas lire beatmakers via RLS
  if (!beatmaker) {
    const admin = createAdminClient()
    const { data: bm } = await admin
      .from('beatmakers')
      .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct, direct_charge_actif, moyens_paiement_acceptes')
      .eq('slug', slug)
      .single()
    beatmaker = bm as BeatmakerRow | null
  }

  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  const admin = createAdminClient()

  const remisePct = await resoudreRemiseAbonne(admin, beatmaker, user, slug)

  const promoResult = await validerCodePromo(admin, beatmaker, code_promo, user, email_acheteur)
  if (!promoResult.ok) return NextResponse.json({ erreur: promoResult.erreur }, { status: promoResult.status })
  const promo = promoResult.value?.promo ?? null
  const codePromoValide = promoResult.value?.codePromoValide ?? null

  const lignesResult = await calculerLignesPanier(admin, beatmaker, items, { remisePct, promo })
  if (!lignesResult.ok) return NextResponse.json({ erreur: lignesResult.erreur }, { status: lignesResult.status })
  const lignes = lignesResult.value

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const cookieClic = (await cookies()).get(COOKIE_CLIC)?.value
  const verifClic = cookieClic ? verifierTokenCampagne(cookieClic) : null
  const attributionCampagne = verifClic && verifClic.beatmakerId === String(beatmaker.id) ? verifClic : null

  // Répartition des fonds : si au moins un article a des splits, toute la
  // session bascule en mode "fonds retenus + transferts manuels par article"
  // (les articles sans split de ce même panier reçoivent alors 100% par transfert
  // plutôt qu'une destination charge directe — cf plan Phase 2c).
  const beatIds = [...new Set(items.map(i => i.beat_id))]
  const { data: splitsData } = await admin
    .from('beat_splits')
    .select('beat_id')
    .in('beat_id', beatIds)
  const hasSplits = (splitsData?.length ?? 0) > 0

  // Direct Charge (Phase 2) uniquement si la boutique l'a explicitement
  // activé ET qu'il n'y a aucun split sur ce panier — un panier avec split
  // reste sur le mode "fonds retenus" quel que soit ce flag (cf plus bas).
  const directChargeActif = !hasSplits && beatmaker.direct_charge_actif && !!beatmaker.stripe_account_id

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: directChargeActif
      ? mapperVersPaymentMethodTypes(normaliserMoyensPaiement(beatmaker.moyens_paiement_acceptes))
      : ['card'],
    line_items: lignes.map(l => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${l.titre} — ${l.nomLicence}`,
          ...(l.image_url ? { images: [l.image_url] } : {}),
        },
        unit_amount: l.prixTotalCents,
      },
      quantity: 1,
    })),
    billing_address_collection: 'required',
    success_url: `${origin}/${slug}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${slug}`,
    metadata: {
      beatmaker_id: String(beatmaker.id),
      slug,
      source_marketing: source_marketing ?? 'direct',
      ...(codePromoValide ? { code_promo: codePromoValide } : {}),
      ...(attributionCampagne ? {
        campagne_id: attributionCampagne.campagneId,
        campagne_client_id: attributionCampagne.clientId,
      } : {}),
    },
  }

  if (hasSplits) {
    const transferGroup = crypto.randomUUID()
    sessionParams.payment_intent_data = { transfer_group: transferGroup }
    sessionParams.metadata = { ...sessionParams.metadata, transfer_group: transferGroup, has_splits: 'true' }
  } else if (!directChargeActif && beatmaker.stripe_account_id) {
    // Ancien flux (destination charge) — inchangé tant que direct_charge_actif
    // n'est pas activé pour cette boutique.
    sessionParams.payment_intent_data = {
      application_fee_amount: 0,
      on_behalf_of: beatmaker.stripe_account_id,
      transfer_data: { destination: beatmaker.stripe_account_id },
    }
  }

  // Direct Charge : la Checkout Session est créée directement sur le compte
  // connecté (options `stripeAccount`, pas un paramètre du corps de la
  // requête) — jamais application_fee_amount/on_behalf_of/transfer_data,
  // invalides sur ce mode.
  const session = directChargeActif
    ? await stripe.checkout.sessions.create(sessionParams, { stripeAccount: beatmaker.stripe_account_id! })
    : await stripe.checkout.sessions.create(sessionParams)

  const prixTotalEuros = lignes.reduce((s, l) => s + l.prixTotalCents, 0) / 100
  const clientId = await resoudreClientId(admin, user)

  const { data: tentative, error: tentativeError } = await admin.from('tentatives_paiement').insert({
    beatmaker_id: beatmaker.id,
    client_id: clientId,
    email: user?.email ?? email_acheteur ?? null,
    prix: prixTotalEuros,
    code_promo: codePromoValide,
    source_marketing: source_marketing ?? 'direct',
    stripe_session_id: session.id,
    statut: 'creee',
  }).select('id').single()

  if (tentativeError) {
    console.error('[checkout] Erreur insert tentative_paiement:', JSON.stringify(tentativeError))
  } else if (tentative) {
    const { error: lignesError } = await admin.from('tentatives_paiement_lignes').insert(
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
    if (lignesError) console.error('[checkout] Erreur insert tentatives_paiement_lignes:', JSON.stringify(lignesError))
  }

  return NextResponse.json({ url: session.url })
}
