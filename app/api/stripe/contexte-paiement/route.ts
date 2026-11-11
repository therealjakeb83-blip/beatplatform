import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'
import { assurerDomainePaiement } from '@/lib/stripe-domaines-paiement'
import { siteDeLaRequete } from '@/lib/boutique-du-domaine'

const configurationsGooglePayAssurees = new Set<string>()

// Le site où se trouve le client : sonoo.app, ou le domaine de CETTE boutique
// (jamais un domaine qui ne lui appartient pas).
async function hostnamePaiement(request: Request, slug: string): Promise<string | null> {
  const site = await siteDeLaRequete(request)
  if (!site.surDomaine) return new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).hostname.toLowerCase()
  return site.slugDomaine === slug ? new URL(site.origine).hostname : null
}

async function assurerGooglePay(stripeAccountId?: string): Promise<void> {
  const cacheKey = stripeAccountId ?? 'plateforme'
  if (configurationsGooglePayAssurees.has(cacheKey)) return

  const options = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  const configurations = await stripe.paymentMethodConfigurations.list({ limit: 100 }, options)

  // En Direct Charge, Stripe utilise la configuration enfant associée à
  // l'application Connect de la plateforme. Sans compte connecté (panier
  // avec splits), c'est la configuration directe par défaut de la plateforme.
  const configuration = stripeAccountId
    ? configurations.data.find(item => (
        item.active && item.is_default && Boolean(item.application) && Boolean(item.parent)
      ))
    : configurations.data.find(item => (
        item.active && item.is_default && !item.application && !item.parent
      ))

  if (!configuration) {
    throw new Error('Configuration de moyens de paiement Stripe introuvable')
  }

  const googlePayActif = configuration.google_pay?.available
    && configuration.google_pay.display_preference.value === 'on'

  const configurationFinale = googlePayActif
    ? configuration
    : await stripe.paymentMethodConfigurations.update(
        configuration.id,
        { google_pay: { display_preference: { preference: 'on' } } },
        options,
      )

  if (configurationFinale.google_pay?.display_preference.value === 'on') {
    configurationsGooglePayAssurees.add(cacheKey)
  }
}

// Résout le contexte Stripe.js à utiliser côté client avant de monter
// Elements pour le paiement express : toujours 'direct' — Stripe.js chargé
// avec {stripeAccount}, le paiement vit directement sur le compte du
// beatmaker. L'ancien mode 'held' (fonds retenus par la plateforme pour les
// splits) n'existe plus : un beat en collaboration est hors vente (Phase 12),
// la vente collab reviendra en Phase 13 avec un paiement par vendeur.
// Remplace l'ancienne route /api/stripe/on-behalf-of (tâche 2.5).
export async function POST(request: Request) {
  const { slug, beat_ids } = await request.json() as { slug?: string; beat_ids?: string[] }
  if (!slug || !beat_ids?.length) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, stripe_account_id')
    .eq('slug', slug)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  // Panier avec au moins un beat collab (Phase 13) : paiement réparti entre
  // vendeurs, Stripe.js chargé sur la plateforme (le moyen de paiement y est
  // seulement enregistré, jamais débité, puis copié chez chaque vendeur).
  const { data: collabs } = await admin
    .from('beats')
    .select('id')
    .in('id', beat_ids)
    .lt('quote_part_proprietaire', 100)
    .limit(1)
  const multi = Boolean(collabs?.length)

  // L'Express Checkout Element exige que le domaine soit enregistré sur le
  // compte qui porte le paiement : le compte connecté du beatmaker, ou la
  // plateforme pour un panier collab (enregistrement du moyen de paiement).
  // Cette route est appelée avant le montage de Stripe Elements, ce qui
  // rattrape aussi les comptes connectés créés avant cette règle.
  const stripeAccountId = multi ? undefined : (beatmaker.stripe_account_id ?? undefined)
  // Ne jamais rendre le checkout entier indisponible si Stripe refuse une
  // opération de configuration : la carte classique doit rester utilisable.
  await Promise.all([
    hostnamePaiement(request, slug)
      .then(hostname => (hostname ? assurerDomainePaiement(hostname, stripeAccountId) : undefined))
      .catch(error => console.error('[contexte-paiement] Domaine wallets non assuré:', error)),
    assurerGooglePay(stripeAccountId)
      .catch(error => console.error('[contexte-paiement] Google Pay non assuré:', error)),
  ])

  if (multi) return NextResponse.json({ mode: 'multi', stripe_account_id: null })
  return NextResponse.json({ mode: 'direct', stripe_account_id: beatmaker.stripe_account_id })
}
