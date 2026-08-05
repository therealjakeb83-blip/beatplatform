import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

// Stripe exige que l'`on_behalf_of` de l'Elements côté client corresponde
// exactement à celui du PaymentIntent créé côté serveur (sinon "on_behalf_of
// mismatch" à la confirmation — y compris avec Apple Pay). Reproduit ici la
// même règle que /api/stripe/express-checkout et /api/stripe/checkout : pas
// de on_behalf_of dès qu'au moins un article a des splits (fonds retenus,
// transferts manuels), sinon le compte Connect du beatmaker.
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

  return NextResponse.json({ on_behalf_of: hasSplits ? null : beatmaker.stripe_account_id })
}
