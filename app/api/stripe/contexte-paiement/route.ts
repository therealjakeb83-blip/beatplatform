import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

// Évite un aller-retour Stripe à chaque checkout sur une même instance
// serveur. La vérification reste idempotente entre instances/serverless.
const domainesAssures = new Set<string>()

function hostnamePaiement(request: Request): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  return new URL(appUrl || request.url).hostname.toLowerCase()
}

async function assurerDomainePaiement(hostname: string, stripeAccountId?: string): Promise<void> {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return

  const cacheKey = `${stripeAccountId ?? 'plateforme'}:${hostname}`
  if (domainesAssures.has(cacheKey)) return

  const options = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  const domaines = await stripe.paymentMethodDomains.list(
    { domain_name: hostname, limit: 1 },
    options,
  )

  let domaine = domaines.data[0]
  if (!domaine) {
    domaine = await stripe.paymentMethodDomains.create(
      { domain_name: hostname, enabled: true },
      options,
    )
  } else if (!domaine.enabled) {
    domaine = await stripe.paymentMethodDomains.update(
      domaine.id,
      { enabled: true },
      options,
    )
  }

  // Un domaine déjà créé avant l'activation complète d'un wallet peut rester
  // inactif. Stripe recommande alors de relancer sa validation.
  if (domaine.google_pay.status !== 'active') {
    domaine = await stripe.paymentMethodDomains.validate(domaine.id, {}, options)
  }

  if (domaine.google_pay.status === 'active') domainesAssures.add(cacheKey)
}

// Résout le contexte Stripe.js à utiliser côté client avant de monter
// Elements pour le paiement express — deux modes possibles, jamais mélangés
// (voir lib/stripe-client.ts) :
//   - 'direct' : vente simple (pas de split) -> Stripe.js chargé avec
//                {stripeAccount}, le paiement vit directement sur le compte
//                du beatmaker.
//   - 'held'   : au moins un split sur ce panier -> fonds retenus sur la
//                plateforme, transferts manuels (voir lib/webhook-paiement.ts,
//                distribuerSplitsArticle) — modèle volontairement inchangé
//                jusqu'à la Phase 13 (choix du PSP collab).
// Remplace l'ancienne route /api/stripe/on-behalf-of (tâche 2.5) — plus de
// mode "destination charge" à distinguer, toutes les boutiques sont
// passées en Direct Charge (2.10).
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

  const { data: splitsData } = await admin
    .from('beat_splits')
    .select('beat_id')
    .in('beat_id', [...new Set(beat_ids)])
  const hasSplits = (splitsData?.length ?? 0) > 0

  // L'Express Checkout Element exige que le domaine soit enregistré sur le
  // compte qui porte réellement la charge. Pour un Direct Charge, c'est le
  // compte connecté du beatmaker ; pour un panier avec splits, la plateforme.
  // Cette route est appelée avant le montage de Stripe Elements, ce qui
  // rattrape aussi les comptes connectés créés avant cette règle.
  const stripeAccountId = hasSplits ? undefined : (beatmaker.stripe_account_id ?? undefined)
  try {
    await assurerDomainePaiement(hostnamePaiement(request), stripeAccountId)
  } catch (error) {
    // Ne jamais rendre le checkout entier indisponible si Stripe refuse la
    // gestion du domaine : la carte classique doit rester utilisable.
    console.error('[contexte-paiement] Domaine wallets non assuré:', error)
  }

  if (hasSplits) {
    return NextResponse.json({ mode: 'held', stripe_account_id: null })
  }

  return NextResponse.json({ mode: 'direct', stripe_account_id: beatmaker.stripe_account_id })
}
