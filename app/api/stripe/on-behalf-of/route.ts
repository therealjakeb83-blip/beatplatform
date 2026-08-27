import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

// Résout le contexte Stripe.js à utiliser côté client avant de monter
// Elements — deux modes possibles, jamais mélangés (voir lib/stripe-client.ts) :
//   - 'direct'      : boutique avec direct_charge_actif=true et pas de split
//                     sur cet achat -> Stripe.js chargé avec {stripeAccount}.
//   - 'destination' : comportement historique (splits, ou flag pas encore
//                     activé) -> Stripe.js global + `on_behalf_of` en option
//                     Elements. Stripe exige que ce on_behalf_of corresponde
//                     exactement à celui du PaymentIntent créé côté serveur
//                     (sinon "on_behalf_of mismatch" à la confirmation, y
//                     compris Apple Pay).
// Renommage/suppression prévus une fois qu'aucune boutique ne dépendra plus
// du mode 'destination' (tâche 2.5).
export async function POST(request: Request) {
  const { slug, beat_ids } = await request.json() as { slug?: string; beat_ids?: string[] }
  if (!slug || !beat_ids?.length) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, stripe_account_id, direct_charge_actif')
    .eq('slug', slug)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  const { data: splitsData } = await admin
    .from('beat_splits')
    .select('beat_id')
    .in('beat_id', [...new Set(beat_ids)])
  const hasSplits = (splitsData?.length ?? 0) > 0

  if (hasSplits) {
    return NextResponse.json({ mode: 'destination', on_behalf_of: null, stripe_account_id: null })
  }

  if (beatmaker.direct_charge_actif && beatmaker.stripe_account_id) {
    return NextResponse.json({ mode: 'direct', on_behalf_of: null, stripe_account_id: beatmaker.stripe_account_id })
  }

  return NextResponse.json({ mode: 'destination', on_behalf_of: beatmaker.stripe_account_id, stripe_account_id: null })
}
