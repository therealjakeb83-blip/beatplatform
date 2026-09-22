import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreRemiseAbonne, validerCodePromo, calculerLignesPanier, resoudreClientId, type ItemPanier } from '@/lib/pricing'
import { calculerPretAVendre } from '@/lib/pret-a-vendre'
import { estRoleAdmin } from '@/lib/admin'
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
    // Page de paiement custom (Phase 9) — coordonnées saisies dans notre
    // propre formulaire, prioritaires sur les billing_details Stripe (qui
    // restent le seul repli pour un paiement express sans formulaire rempli,
    // ex. Apple/Google Pay depuis la popup licence).
    prenom?: string
    nom?: string
    telephone?: string
    adresse?: string
    code_postal?: string
    ville?: string
    pays?: string
    type_client?: 'particulier' | 'professionnel'
    raison_sociale?: string
    numero_tva?: string
    newsletter_opt_in?: boolean
  }
  const {
    slug, code_promo, email_acheteur, source_marketing,
    prenom, nom, telephone, adresse, code_postal, ville, pays,
    type_client, raison_sociale, numero_tva, newsletter_opt_in,
  } = body

  const items: ItemPanier[] = body.items?.length
    ? body.items
    : (body.beat_id && body.licence_id ? [{ beat_id: body.beat_id, licence_id: body.licence_id }] : [])

  if (!slug || !items.length) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const CHAMPS_BEATMAKER = 'id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct, role, abonnement_exempte'

  const { data: beatmakerRow } = await supabase
    .from('beatmakers')
    .select(CHAMPS_BEATMAKER)
    .eq('slug', slug)
    .single()

  type BeatmakerRow = { id: string; stripe_account_id: string | null; tva_active: boolean; tva_taux: number | null; abo_remise_pct: number | null; abo_actif: boolean; role: string | null; abonnement_exempte: boolean }
  let beatmaker = beatmakerRow as BeatmakerRow | null

  const admin = createAdminClient()

  if (!beatmaker) {
    const { data: bm } = await admin
      .from('beatmakers')
      .select(CHAMPS_BEATMAKER)
      .eq('slug', slug)
      .single()
    beatmaker = bm as BeatmakerRow | null
  }

  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  // Checklist « prêt à vendre » (Phase 12 lot 2, Q7) — jusqu'ici seule
  // l'existence de stripe_account_id était vérifiée, jamais que le compte
  // puisse réellement encaisser ni le reste des critères (TVA, adresse,
  // mandats, CGV/mentions légales). A est toujours seul concédant/maître de
  // la vente pour un achat sur sa boutique (un beat en collaboration non
  // terminée est déjà exclu par calculerLignesPanier via hors_vente_collab).
  // Boutiques de test exemptées + compte admin non concernés (Q7b) — même
  // laisser-passer que le gate d'accès dashboard (Étape 8b), pour ne pas
  // bloquer les comptes de test déjà utilisés par ailleurs sans configurer
  // ces 8 critères sur chacun d'eux.
  const exempteReadiness = estRoleAdmin(beatmaker.role) || beatmaker.abonnement_exempte
  if (!exempteReadiness) {
    const readiness = await calculerPretAVendre(admin, beatmaker.id, { estConcedant: true })
    if (!readiness.pret) {
      return NextResponse.json(
        { erreur: 'Cette boutique n\'est pas encore prête à vendre — réessaie plus tard.' },
        { status: 400 },
      )
    }
  }

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
      newsletter_opt_in: newsletter_opt_in === true ? 'true' : 'false',
      ...(type_client === 'professionnel' && raison_sociale?.trim()
        ? { acheteur_raison_sociale: raison_sociale.trim().slice(0, 200) }
        : {}),
      ...(type_client === 'professionnel' && numero_tva?.trim()
        ? { acheteur_numero_tva: numero_tva.trim().toUpperCase().slice(0, 32) }
        : {}),
      ...(codePromoValide ? { code_promo: codePromoValide } : {}),
    },
  }

  // Un beat en collaboration non terminée est déjà refusé par
  // calculerLignesPanier (hors_vente_collab) : plus aucun mode « fonds retenus
  // + transferts » n'est possible ici (Phase 12, remplacé par la Phase 13).
  const directChargeActif = !!beatmaker.stripe_account_id

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
    email: (user?.email ?? email_acheteur ?? null)?.toLowerCase().trim() || null,
    prix: totalCents / 100,
    code_promo: codePromoValide,
    source_marketing: source_marketing ?? 'direct',
    stripe_payment_intent_id: paymentIntent.id,
    statut: 'creee',
    prenom: prenom ?? null,
    nom: nom ?? null,
    telephone: telephone ?? null,
    adresse: adresse ?? null,
    code_postal: code_postal ?? null,
    ville: ville ?? null,
    pays: pays ?? null,
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
