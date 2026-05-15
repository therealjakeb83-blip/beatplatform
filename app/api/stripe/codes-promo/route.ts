import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single()

  const coupons = await stripe.coupons.list({ limit: 50 })

  return NextResponse.json({ coupons: coupons.data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { nom, type, valeur, expiration } = await request.json()

  if (!nom || !type || !valeur) {
    return NextResponse.json({ erreur: 'Champs manquants' }, { status: 400 })
  }

  const couponParams: Parameters<typeof stripe.coupons.create>[0] = {
    name: nom,
    currency: 'eur',
    duration: 'once',
    ...(expiration ? { redeem_by: Math.floor(new Date(expiration).getTime() / 1000) } : {}),
  }

  if (type === 'pourcentage') {
    couponParams.percent_off = Number(valeur)
  } else {
    couponParams.amount_off = Math.round(Number(valeur) * 100)
  }

  const coupon = await stripe.coupons.create(couponParams)

  const promoCode = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code: nom.toUpperCase().replace(/\s+/g, ''),
  })

  return NextResponse.json({ coupon, promoCode })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { coupon_id } = await request.json()
  if (!coupon_id) return NextResponse.json({ erreur: 'ID manquant' }, { status: 400 })

  await stripe.coupons.del(coupon_id)

  return NextResponse.json({ ok: true })
}
