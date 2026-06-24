import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  let stripe_coupon_id: string | null = null
  let stripe_promotion_code_id: string | null = null

  if (body.type_remise === 'abonnement') {
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
      console.error('[codes-promo POST] Stripe:', e)
    }
  }

  const { data, error } = await admin
    .from('codes_promo')
    .insert({
      beatmaker_id:            user.id,
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
      utilisations:            0,
      statut:                  'actif',
      stripe_coupon_id,
      stripe_promotion_code_id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ erreur: 'Ce code existe déjà dans votre boutique' }, { status: 409 })
    }
    console.error('[codes-promo POST]', error)
    return NextResponse.json({ erreur: error.message }, { status: 500 })
  }

  return NextResponse.json({ code: data })
}
