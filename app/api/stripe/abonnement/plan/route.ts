import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { descriptionAvecTva } from '@/lib/prix-affiche'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 })

  const { nom, description, prix_cents, remise_pct, actif, recurrence_cadeau_mois } = await request.json()

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id, stripe_product_id, stripe_produit_compte, abo_prix, tva_active, tva_taux')
    .eq('id', user.id)
    .single()

  if (!beatmaker) return NextResponse.json({ erreur: 'Beatmaker introuvable' }, { status: 404 })

  // Paiement direct (2026-10-01) : le produit vit sur le compte Stripe du
  // beatmaker et le prix est fixé à chaque souscription (un abonné garde son
  // prix à vie). Ici, seul le nom/la description du produit déjà créé sur son
  // compte est tenu à jour ; il est créé à la 1re souscription sinon
  // (lib/abonnement-boutique.ts).
  if (beatmaker.stripe_product_id && beatmaker.stripe_account_id && beatmaker.stripe_produit_compte === beatmaker.stripe_account_id) {
    const descriptionComplete = descriptionAvecTva(description ?? null, prix_cents ?? beatmaker.abo_prix ?? 0, { tvaActive: beatmaker.tva_active, tvaTaux: beatmaker.tva_taux })
    await stripe.products.update(beatmaker.stripe_product_id, {
      name: nom || 'Abonnement boutique',
      description: descriptionComplete,
    }, { stripeAccount: beatmaker.stripe_account_id }).catch(err => console.error('[abonnement/plan] Mise à jour produit:', err instanceof Error ? err.message : err))
  }

  await supabase
    .from('beatmakers')
    .update({
      abo_actif: actif ?? true,
      abo_nom: nom,
      abo_description: description ?? null,
      abo_prix: prix_cents,
      abo_remise_pct: remise_pct,
      abo_recurrence_cadeau_mois: recurrence_cadeau_mois && recurrence_cadeau_mois > 0 ? recurrence_cadeau_mois : 4,
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
    .select('abo_actif, abo_nom, abo_description, abo_prix, abo_remise_pct, abo_recurrence_cadeau_mois, stripe_price_id')
    .eq('id', user.id)
    .single()

  return NextResponse.json(data ?? {})
}
