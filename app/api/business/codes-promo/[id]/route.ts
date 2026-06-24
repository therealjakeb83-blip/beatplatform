import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const { data: existant } = await admin
    .from('codes_promo')
    .select('type_remise, type_valeur, valeur, mensualites, stripe_coupon_id, stripe_promotion_code_id')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!existant) return NextResponse.json({ erreur: 'Code introuvable' }, { status: 404 })

  let stripe_coupon_id = existant.stripe_coupon_id
  let stripe_promotion_code_id = existant.stripe_promotion_code_id
  const wasAbonnement = existant.type_remise === 'abonnement'
  const isAbonnement  = body.type_remise === 'abonnement'

  const stripeNeedsRebuild = isAbonnement && (
    !wasAbonnement ||
    Number(body.valeur) !== Number(existant.valeur) ||
    body.type_valeur !== existant.type_valeur ||
    (body.mensualites ?? null) !== existant.mensualites
  )

  if (!isAbonnement && wasAbonnement && existant.stripe_coupon_id) {
    try { await stripe.coupons.del(existant.stripe_coupon_id) } catch { /* ignore */ }
    stripe_coupon_id = null
    stripe_promotion_code_id = null
  }

  if (stripeNeedsRebuild) {
    if (existant.stripe_coupon_id) {
      try { await stripe.coupons.del(existant.stripe_coupon_id) } catch { /* ignore */ }
    }
    try {
      const mensualites: number | null = body.mensualites ?? null
      const duration = mensualites == null ? 'forever' : mensualites === 1 ? 'once' : 'repeating'
      const couponParams: Record<string, unknown> = {
        name: body.code,
        currency: 'eur',
        duration,
        ...(duration === 'repeating' ? { duration_in_months: mensualites } : {}),
        ...(body.date_expiration ? { redeem_by: Math.floor(new Date(body.date_expiration).getTime() / 1000) } : {}),
        ...(body.limite_par_code ? { max_redemptions: body.limite_par_code } : {}),
      }
      if (body.type_valeur === 'pourcentage') couponParams.percent_off = Number(body.valeur)
      else couponParams.amount_off = Math.round(Number(body.valeur) * 100)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coupon = await (stripe.coupons.create as any)(couponParams)
      stripe_coupon_id = coupon.id

      const promoCode = await stripe.promotionCodes.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        promotion: { type: 'coupon', coupon: coupon.id } as any,
        code: String(body.code).toUpperCase().replace(/\s+/g, ''),
        ...(body.date_expiration ? { expires_at: Math.floor(new Date(body.date_expiration).getTime() / 1000) } : {}),
        ...(body.limite_par_code ? { max_redemptions: body.limite_par_code } : {}),
        restrictions: {
          ...(body.premiere_commande ? { first_time_transaction: true } : {}),
          ...(body.depense_min ? { minimum_amount: Math.round(Number(body.depense_min) * 100), minimum_amount_currency: 'eur' } : {}),
        },
      })
      stripe_promotion_code_id = promoCode.id
    } catch (e) {
      console.error('[codes-promo PATCH] Stripe:', e)
    }
  }

  const { data, error } = await admin
    .from('codes_promo')
    .update({
      code:                    String(body.code).trim().toUpperCase(),
      description:             body.description || null,
      type_remise:             body.type_remise,
      type_valeur:             body.type_valeur,
      valeur:                  Number(body.valeur),
      mensualites:             body.mensualites ?? null,
      date_debut:              body.date_debut || null,
      date_expiration:         body.date_expiration || null,
      depense_min:             body.depense_min != null ? Number(body.depense_min) : null,
      depense_max:             body.depense_max != null ? Number(body.depense_max) : null,
      premiere_commande:       !!body.premiere_commande,
      utilisation_individuelle: !!body.utilisation_individuelle,
      beats_inclus:            body.beats_inclus?.length ? body.beats_inclus : null,
      beats_exclus:            body.beats_exclus ?? [],
      licences_eligibles:      body.licences_eligibles?.length ? body.licences_eligibles : null,
      emails_autorises:        body.emails_autorises ?? [],
      emails_exclus:           body.emails_exclus ?? [],
      limite_par_code:         body.limite_par_code ?? null,
      limite_par_article:      body.limite_par_article ?? null,
      limite_par_utilisateur:  body.limite_par_utilisateur ?? null,
      stripe_coupon_id,
      stripe_promotion_code_id,
    })
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ erreur: 'Ce code existe déjà dans votre boutique' }, { status: 409 })
    }
    return NextResponse.json({ erreur: error.message }, { status: 500 })
  }

  return NextResponse.json({ code: data })
}
