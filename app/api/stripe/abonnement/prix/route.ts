import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { preparerAbonnement } from '@/lib/abonnement-boutique'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Montant de l'abonnement affiché sur /paiement/[slug] (mode abonnement) —
// même calcul que /api/stripe/abonnement/creer, qui débite ce montant exact.
export async function POST(request: Request) {
  const { slug, code_promo, email } = await request.json() as { slug?: string; code_promo?: string; email?: string }
  if (!slug) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const resultat = await preparerAbonnement(createAdminClient(), slug, user, code_promo, email)
  if (!resultat.ok) {
    const emailManquant = resultat.erreur === 'Code non autorisé pour cette adresse email' && !user && !email
    return NextResponse.json({ erreur: resultat.erreur, a_restriction_email: emailManquant }, { status: resultat.status })
  }

  const { prixCents, premierCents, suite, tva, promo } = resultat.value
  return NextResponse.json({
    prixCents,
    premierCents,
    suite,
    tva: tva ? { montantCents: tva.montantCents, taux: tva.taux } : null,
    code: promo ? { code: promo.code, type_valeur: promo.type_valeur, valeur: promo.valeur } : null,
  })
}
