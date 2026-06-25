import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { code, beat_id, slug } = await request.json()

  if (!code || !beat_id || !slug) {
    return NextResponse.json({ valide: false, erreur: 'Paramètres manquants' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!beatmaker) {
    return NextResponse.json({ valide: false, erreur: 'Boutique introuvable' })
  }

  const { data: promo } = await supabase
    .from('codes_promo')
    .select('*')
    .eq('beatmaker_id', beatmaker.id)
    .eq('code', (code as string).toUpperCase().trim())
    .eq('statut', 'actif')
    .single()

  if (!promo) {
    return NextResponse.json({ valide: false, erreur: 'Code invalide ou inactif' })
  }

  if (promo.type_remise === 'abonnement') {
    return NextResponse.json({ valide: false, erreur: 'Ce code est réservé aux abonnements' })
  }

  const now = new Date()
  if (promo.date_debut && new Date(promo.date_debut) > now) {
    return NextResponse.json({ valide: false, erreur: "Ce code n'est pas encore actif" })
  }
  if (promo.date_expiration && new Date(promo.date_expiration) < now) {
    return NextResponse.json({ valide: false, erreur: 'Ce code a expiré' })
  }

  if (promo.beats_inclus?.length > 0 && !promo.beats_inclus.includes(beat_id)) {
    return NextResponse.json({ valide: false, erreur: 'Ce code ne s\'applique pas à ce beat' })
  }
  if (promo.beats_exclus?.includes(beat_id)) {
    return NextResponse.json({ valide: false, erreur: 'Ce code ne s\'applique pas à ce beat' })
  }

  if (promo.limite_par_code !== null && promo.utilisations >= promo.limite_par_code) {
    return NextResponse.json({ valide: false, erreur: "Ce code a atteint sa limite d'utilisation" })
  }

  return NextResponse.json({
    valide: true,
    type_valeur: promo.type_valeur,
    valeur: Number(promo.valeur),
    depense_min: promo.depense_min ? Number(promo.depense_min) : null,
    licences_eligibles: promo.licences_eligibles ?? null,
    a_restriction_email: (promo.emails_autorises?.length ?? 0) > 0,
  })
}
