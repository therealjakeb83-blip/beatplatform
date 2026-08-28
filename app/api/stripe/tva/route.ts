import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/stripe'
import { descriptionAvecTva } from '@/lib/prix-affiche'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { tva_active, tva_taux, tva_numero } = await request.json()
  const actif = Boolean(tva_active)

  let taux: number | null = null
  if (actif) {
    taux = Number(tva_taux)
    if (!Number.isFinite(taux) || taux < 0 || taux > 100) {
      return NextResponse.json({ erreur: 'Le taux de TVA doit être un nombre entre 0 et 100.' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('beatmakers')
    .update({
      tva_active: actif,
      tva_taux: taux,
      tva_numero: actif ? (tva_numero ?? null) : null,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  // Répercute la mention TVA sur la description Stripe de l'abonnement (page
  // de paiement hébergée, hors de notre contrôle sinon) — jamais le prix lui-
  // même : les abonnés déjà actifs gardent leur montant, seule la mention
  // change pour les futurs abonnés (TVA toujours absorbée, voir lib/pricing.ts).
  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_product_id, abo_prix, abo_description')
    .eq('id', user.id)
    .single()

  if (beatmaker?.stripe_product_id && beatmaker.abo_prix) {
    const descriptionComplete = descriptionAvecTva(beatmaker.abo_description, beatmaker.abo_prix, { tvaActive: actif, tvaTaux: taux })
    await stripe.products.update(beatmaker.stripe_product_id, { description: descriptionComplete })
  }

  return NextResponse.json({ ok: true })
}
