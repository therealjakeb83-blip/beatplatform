import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 })

  const { nom, description, prix_cents, remise_pct, essai_jours, actif, recurrence_cadeau_mois } = await request.json()

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_product_id, stripe_price_id, abo_prix')
    .eq('id', user.id)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Beatmaker introuvable' }, { status: 404 })

  let productId = beatmaker.stripe_product_id as string | null
  let priceId = beatmaker.stripe_price_id as string | null

  if (!productId) {
    const product = await stripe.products.create({
      name: nom || 'Abonnement boutique',
      ...(description ? { description } : {}),
    })
    productId = product.id
  } else {
    await stripe.products.update(productId, {
      name: nom || 'Abonnement boutique',
      ...(description ? { description } : {}),
    })
  }

  const prixChange = prix_cents && prix_cents !== beatmaker.abo_prix
  if (prixChange || !priceId) {
    if (priceId) {
      await stripe.prices.update(priceId, { active: false })
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: 'eur',
      recurring: { interval: 'month' },
      unit_amount: prix_cents,
    })
    priceId = price.id
  }

  await supabase
    .from('beatmakers')
    .update({
      abo_actif: actif ?? true,
      abo_nom: nom,
      abo_description: description ?? null,
      abo_prix: prix_cents,
      abo_remise_pct: remise_pct,
      abo_essai_jours: essai_jours,
      abo_recurrence_cadeau_mois: recurrence_cadeau_mois && recurrence_cadeau_mois > 0 ? recurrence_cadeau_mois : 4,
      stripe_product_id: productId,
      stripe_price_id: priceId,
    })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 })

  const { data } = await supabase
    .from('beatmakers')
    .select('abo_actif, abo_nom, abo_description, abo_prix, abo_remise_pct, abo_essai_jours, abo_recurrence_cadeau_mois, stripe_price_id')
    .eq('id', user.id)
    .single()

  return NextResponse.json(data ?? {})
}
