import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { descriptionAvecTva } from '@/lib/prix-affiche'
import { validerCodePromo, type UtilisateurPourPrix } from '@/lib/pricing'
import { calculerPretAVendreOuExempte } from '@/lib/pret-a-vendre'
import { decomposerTva } from '@/lib/collaboration-parts'
import { normaliserEmail } from '@/lib/email'

// Abonnement boutique (artiste → beatmaker) en paiement direct : tout vit sur
// le compte Stripe du beatmaker (produit, coupon, client, abonnement), jamais
// sur celui de la plateforme — même règle que les licences. Payé sur la page
// /paiement/[slug] (mode abonnement), plus sur la page Stripe hébergée.

export type PromoAbonnement = {
  id: string
  code: string
  type_valeur: 'pourcentage' | 'montant'
  valeur: number
  mensualites: number | null
}

export const MINIMUM_STRIPE_CENTS = 50

// Compte Stripe sur lequel vit un abonnement déjà créé : celui mémorisé à la
// souscription (paiement direct). Vide = ancien abonnement créé sur la
// plateforme avant le 2026-10-01.
export function optionsCompteAbonnement(stripeAccountId: string | null | undefined): Stripe.RequestOptions | undefined {
  return stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
}

// Portail Stripe sur le compte du beatmaker : changer de carte uniquement
// (décision de Jake, lot 2) — pas d'historique de factures Stripe (les
// factures officielles sont dans « Mes factures »), pas d'annulation (bouton
// de « Mon abonnement »). Créé au premier usage, retrouvé ensuite.
export async function assurerConfigurationPortail(stripeAccount: string): Promise<string> {
  const options = { stripeAccount }
  const existantes = await stripe.billingPortal.configurations.list({ active: true, limit: 20 }, options)
  const trouvee = existantes.data.find(c => c.metadata?.my_producer === 'carte')
  if (trouvee) return trouvee.id
  const configuration = await stripe.billingPortal.configurations.create({
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: false },
      subscription_cancel: { enabled: false },
      customer_update: { enabled: false },
    },
    metadata: { my_producer: 'carte' },
  }, options)
  return configuration.id
}

// Même arrondi que Stripe pour un coupon en pourcentage (remise arrondie au
// centime) : le montant affiché doit être exactement celui débité. Vérifié
// après création contre la vraie facture Stripe (voir creerAbonnement).
export function montantRemiseCents(prixCents: number, promo: PromoAbonnement | null): number {
  if (!promo) return 0
  const remise = promo.type_valeur === 'pourcentage'
    ? Math.round((prixCents * Number(promo.valeur)) / 100)
    : Math.round(Number(promo.valeur) * 100)
  return Math.min(prixCents, Math.max(0, remise))
}

export function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

// « puis 6,99 €/mois », « pendant 3 mois, puis 6,99 €/mois » — ou null quand
// le premier montant est aussi celui de tous les mois suivants.
export function suiteAbonnement(prixCents: number, promo: PromoAbonnement | null): string | null {
  if (!promo || montantRemiseCents(prixCents, promo) === 0) return null
  const prixMois = `${formatEuros(prixCents)}/mois`
  if (promo.mensualites == null) return null
  if (promo.mensualites <= 1) return `puis ${prixMois}`
  return `pendant ${promo.mensualites} mois, puis ${prixMois}`
}

type BeatmakerAbonnement = {
  id: string
  stripe_account_id: string
  stripe_product_id: string | null
  stripe_produit_compte: string | null
  abo_nom: string | null
  abo_description: string | null
  abo_prix: number
  tva_active: boolean
  tva_taux: number | null
}

// Produit « abonnement » du beatmaker, sur SON compte Stripe. Recréé si le
// produit enregistré vit ailleurs (créé sur la plateforme avant ce lot, ou
// compte Stripe du beatmaker remplacé depuis).
export async function assurerProduitAbonnement(admin: SupabaseClient, bm: BeatmakerAbonnement): Promise<string> {
  const options = { stripeAccount: bm.stripe_account_id }
  const nom = bm.abo_nom || 'Abonnement boutique'
  const description = descriptionAvecTva(bm.abo_description ?? null, bm.abo_prix, { tvaActive: bm.tva_active, tvaTaux: bm.tva_taux }) || undefined

  if (bm.stripe_product_id && bm.stripe_produit_compte === bm.stripe_account_id) return bm.stripe_product_id

  const produit = await stripe.products.create({ name: nom, description }, options)
  const { error } = await admin.from('beatmakers')
    .update({ stripe_product_id: produit.id, stripe_produit_compte: bm.stripe_account_id, stripe_price_id: null })
    .eq('id', bm.id)
  if (error) console.error('[abonnement-boutique] Erreur enregistrement produit:', JSON.stringify(error))
  return produit.id
}

// Coupon Stripe du code promo, sur le compte du beatmaker. L'identifiant
// reprend la valeur du code : un code modifié depuis donne un nouveau coupon,
// jamais l'ancienne remise. Limites (dates, nombre, email) vérifiées par
// notre serveur avant (validerCodePromo), jamais confiées à Stripe.
export async function assurerCouponAbonnement(promo: PromoAbonnement, stripeAccount: string): Promise<string> {
  const options = { stripeAccount }
  const valeurCle = promo.type_valeur === 'pourcentage' ? `p${promo.valeur}` : `m${Math.round(Number(promo.valeur) * 100)}`
  const id = `mp_${promo.id.replace(/-/g, '').slice(0, 16)}_${valeurCle}_${promo.mensualites ?? 'x'}`.replace(/[^A-Za-z0-9_]/g, '_')
  try {
    await stripe.coupons.retrieve(id, {}, options)
    return id
  } catch {
    const duree: Stripe.CouponCreateParams.Duration = promo.mensualites == null ? 'forever' : promo.mensualites <= 1 ? 'once' : 'repeating'
    await stripe.coupons.create({
      id,
      name: promo.code,
      duration: duree,
      ...(duree === 'repeating' ? { duration_in_months: promo.mensualites! } : {}),
      ...(promo.type_valeur === 'pourcentage'
        ? { percent_off: Number(promo.valeur) }
        : { amount_off: Math.round(Number(promo.valeur) * 100), currency: 'eur' }),
    }, options)
    return id
  }
}

export type MetadataAbonnement = Record<string, string>

// Abonnement à 1er paiement > 0 : créé « incomplet », le navigateur confirme
// le paiement de la 1re facture (carte, Apple Pay, Google Pay). Rien n'est
// enregistré chez nous avant que Stripe confirme ce paiement (webhook).
export async function creerAbonnementAPayer(params: {
  stripeAccount: string
  customerId: string
  produitId: string
  prixCents: number
  couponId: string | null
  premierCentsAttendu: number
  metadata: MetadataAbonnement
}): Promise<{ subscriptionId: string; clientSecret: string }> {
  const options = { stripeAccount: params.stripeAccount }
  const abonnement = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price_data: { currency: 'eur', product: params.produitId, unit_amount: params.prixCents, recurring: { interval: 'month' } } }],
    ...(params.couponId ? { discounts: [{ coupon: params.couponId }] } : {}),
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription', payment_method_types: ['card', 'link'] },
    metadata: params.metadata,
    expand: ['latest_invoice.confirmation_secret'],
  }, options)

  const facture = abonnement.latest_invoice as Stripe.Invoice | null
  const clientSecret = facture?.confirmation_secret?.client_secret
  // Prix affiché = prix débité : si Stripe calcule un autre montant que le
  // nôtre (arrondi, réglage inattendu), on n'encaisse rien.
  if (!clientSecret || facture?.amount_due !== params.premierCentsAttendu) {
    await stripe.subscriptions.cancel(abonnement.id, {}, options).catch(() => {})
    throw new Error(`Montant Stripe ${facture?.amount_due} ≠ montant affiché ${params.premierCentsAttendu}`)
  }
  return { subscriptionId: abonnement.id, clientSecret }
}

// Abonnement à 1er paiement nul (code promo 100 %) : la carte est d'abord
// enregistrée (SetupIntent), puis l'abonnement est créé avec elle — jamais
// d'abonnement actif sans carte pour les mois suivants (décision D2).
export async function creerAbonnementGratuitDepuisCarte(stripeAccount: string, setupIntent: Stripe.SetupIntent): Promise<string> {
  const options = { stripeAccount }
  const meta = setupIntent.metadata ?? {}
  const moyen = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id
  const customer = typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id
  if (!moyen || !customer || !meta.produit_id || !meta.prix_cents) throw new Error(`SetupIntent incomplet : ${setupIntent.id}`)

  const { produit_id, coupon_id, ...metadata } = meta
  const abonnement = await stripe.subscriptions.create({
    customer,
    default_payment_method: moyen,
    items: [{ price_data: { currency: 'eur', product: produit_id, unit_amount: Number(meta.prix_cents), recurring: { interval: 'month' } } }],
    ...(coupon_id ? { discounts: [{ coupon: coupon_id }] } : {}),
    payment_settings: { payment_method_types: ['card', 'link'] },
    metadata: { ...metadata, type: 'abonnement_boutique' },
  }, { ...options, idempotencyKey: `abonnement-${setupIntent.id}` })
  return abonnement.id
}

export type PreparationAbonnement = {
  beatmaker: BeatmakerAbonnement & { slug: string; nom_artiste: string }
  promo: PromoAbonnement | null
  prixCents: number
  premierCents: number
  suite: string | null
  tva: { montantCents: number; taux: number } | null
  emailCompte: string | null
}

// Tout ce que l'affichage du prix ET la création de l'abonnement doivent
// calculer de la même façon (prix affiché = prix débité) : boutique prête à
// vendre, déjà abonné, code promo, premier montant, TVA contenue.
export async function preparerAbonnement(
  admin: SupabaseClient,
  slug: string,
  user: UtilisateurPourPrix,
  codePromo: string | undefined,
  emailSaisi: string | undefined,
): Promise<{ ok: true; value: PreparationAbonnement } | { ok: false; erreur: string; status: number }> {
  const { data: bm } = await admin
    .from('beatmakers')
    .select('id, slug, nom_artiste, statut, abo_actif, abo_prix, abo_remise_pct, abo_nom, abo_description, stripe_account_id, stripe_product_id, stripe_produit_compte, tva_active, tva_taux')
    .eq('slug', slug)
    .maybeSingle()

  if (!bm || bm.statut === 'suspendu' || !bm.abo_actif || !bm.abo_prix) {
    return { ok: false, erreur: 'Abonnement non disponible sur cette boutique.', status: 404 }
  }
  const pret = bm.stripe_account_id ? await calculerPretAVendreOuExempte(admin, bm.id, { estConcedant: true }) : { pret: false }
  if (!bm.stripe_account_id || !pret.pret) {
    return { ok: false, erreur: 'Cette boutique n\'est pas encore prête à vendre — réessaie plus tard.', status: 400 }
  }

  // Le compte connecté prime : son email est celui de l'abonnement, jamais un
  // autre saisi dans le formulaire.
  const emailCompte = user?.email ? normaliserEmail(user.email) : null
  const email = emailCompte ?? (emailSaisi ? normaliserEmail(emailSaisi) : null)

  if (email || user) {
    const filtres = [email ? `acheteur_email.eq.${email}` : null, user ? `client_id.eq.${user.id}` : null].filter(Boolean).join(',')
    const { data: dejaAbonne } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', bm.id)
      .in('statut', ['actif', 'impaye', 'suspendu'])
      .or(filtres)
      .limit(1)
      .maybeSingle()
    if (dejaAbonne) return { ok: false, erreur: 'Tu es déjà abonné à cette boutique.', status: 409 }
  }

  const promoResult = await validerCodePromo(admin, bm, codePromo, user, email ?? undefined, { pourAbonnement: true })
  if (!promoResult.ok) return promoResult
  const promoBrut = promoResult.value?.promo
  const promo: PromoAbonnement | null = promoBrut
    ? {
        id: String(promoBrut.id),
        code: promoResult.value!.codePromoValide,
        type_valeur: promoBrut.type_valeur === 'montant' ? 'montant' : 'pourcentage',
        valeur: Number(promoBrut.valeur),
        mensualites: promoBrut.mensualites == null ? null : Number(promoBrut.mensualites),
      }
    : null

  const prixCents = Number(bm.abo_prix)
  const premierCents = prixCents - montantRemiseCents(prixCents, promo)
  if (premierCents > 0 && premierCents < MINIMUM_STRIPE_CENTS) {
    return { ok: false, erreur: 'Ce code donne un montant trop faible pour un paiement par carte (minimum 0,50 €).', status: 400 }
  }

  const taux = bm.tva_active && bm.tva_taux ? Number(bm.tva_taux) : 0
  const tvaCents = decomposerTva(premierCents, taux).tvaCents

  return {
    ok: true,
    value: {
      beatmaker: { ...bm, stripe_account_id: bm.stripe_account_id, abo_prix: prixCents },
      promo,
      prixCents,
      premierCents,
      suite: suiteAbonnement(prixCents, promo),
      tva: tvaCents > 0 ? { montantCents: tvaCents, taux } : null,
      emailCompte,
    },
  }
}
