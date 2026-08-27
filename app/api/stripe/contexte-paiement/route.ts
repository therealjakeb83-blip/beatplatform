import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

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

  if (hasSplits) {
    return NextResponse.json({ mode: 'held', stripe_account_id: null })
  }

  return NextResponse.json({ mode: 'direct', stripe_account_id: beatmaker.stripe_account_id })
}
