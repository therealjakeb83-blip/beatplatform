import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { code, beat_id, beat_ids, slug, email } = await request.json()

  // beat_id (legacy, page beat seule) ou beat_ids (panier) — au moins un des deux
  const beatIds: string[] = beat_ids?.length ? beat_ids : (beat_id ? [beat_id] : [])

  if (!code || !beatIds.length || !slug) {
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

  const auMoinsUnEligible = beatIds.some((id: string) =>
    (!promo.beats_inclus?.length || promo.beats_inclus.includes(id)) &&
    !promo.beats_exclus?.includes(id)
  )
  if (!auMoinsUnEligible) {
    return NextResponse.json({ valide: false, erreur: "Ce code ne s'applique à aucun article du panier" })
  }

  if (promo.limite_par_code !== null && promo.utilisations >= promo.limite_par_code) {
    return NextResponse.json({ valide: false, erreur: "Ce code a atteint sa limite d'utilisation" })
  }

  // Code réservé à des emails précis (ex. code personnel généré par la
  // relance inactivité) — fail closed : sans email connu, impossible de
  // vérifier la restriction, donc pas de "valide" optimiste en attendant.
  if (promo.emails_autorises?.length > 0) {
    if (!email) {
      return NextResponse.json({
        valide: false,
        erreur: 'Ce code est personnel — indique ton email ci-dessous puis réessaie',
        a_restriction_email: true,
      })
    }
    if (!promo.emails_autorises.includes(email as string)) {
      return NextResponse.json({ valide: false, erreur: 'Adresse email non autorisée pour ce code' })
    }
  }
  if (email && promo.emails_exclus?.includes(email as string)) {
    return NextResponse.json({ valide: false, erreur: 'Adresse email non autorisée pour ce code' })
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
