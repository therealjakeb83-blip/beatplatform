import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreRemiseAbonne, validerCodePromo, calculerLignesPanier, type ItemPanier } from '@/lib/pricing'
import { NextResponse } from 'next/server'

// Prévisualisation du montant réel (TVA/remises/code promo déjà inclus) —
// utilisée par le paiement express (Apple Pay/Google Pay) pour que le
// montant affiché dans la fenêtre native soit exactement celui facturé.
// Ne crée jamais de PaymentIntent ni aucune écriture en base, contrairement
// à /api/stripe/express-checkout — appel possible à chaque changement de
// licence sélectionnée sans effet de bord.
export async function POST(request: Request) {
  const body = await request.json() as {
    beat_id?: string
    licence_id?: string
    items?: ItemPanier[]
    slug?: string
    code_promo?: string
    email_acheteur?: string
  }
  const { slug, code_promo, email_acheteur } = body

  const items: ItemPanier[] = body.items?.length
    ? body.items
    : (body.beat_id && body.licence_id ? [{ beat_id: body.beat_id, licence_id: body.licence_id }] : [])

  if (!slug || !items.length) {
    return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct')
    .eq('slug', slug)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  const remisePct = await resoudreRemiseAbonne(admin, beatmaker, user, slug)

  const promoResult = await validerCodePromo(admin, beatmaker, code_promo, user, email_acheteur)
  if (!promoResult.ok) return NextResponse.json({ erreur: promoResult.erreur }, { status: promoResult.status })
  const promo = promoResult.value?.promo ?? null

  const lignesResult = await calculerLignesPanier(admin, beatmaker, items, { remisePct, promo })
  if (!lignesResult.ok) return NextResponse.json({ erreur: lignesResult.erreur }, { status: lignesResult.status })

  const totalCents = lignesResult.value.reduce((s, l) => s + l.prixTotalCents, 0)

  return NextResponse.json({ totalCents })
}
