import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

// Calcul de prix serveur pour un achat de beat — jamais confiance dans le
// front. Partagé entre /api/stripe/checkout (panier classique) et
// /api/stripe/express-checkout (Apple Pay/Google Pay/PayPal, achat unitaire).

export type ItemPanier = { beat_id: string; licence_id: string }

export type LigneCalculee = {
  beat_id: string
  licence_id: string
  titre: string
  image_url: string | null
  nomLicence: string
  prixTotalCents: number
  reductionCodeCents: number
  codePromoApplique: boolean
}

export type BeatmakerPourPrix = {
  id: string
  stripe_account_id: string | null
  tva_active: boolean
  tva_taux: number | null
  abo_actif: boolean
  abo_remise_pct: number | null
}

export type UtilisateurPourPrix = { id: string; email?: string | null } | null

export type ResultatPrix<T> = { ok: true; value: T } | { ok: false; erreur: string; status: number }

/** Remise membre si le client est abonné à la boutique (connecté ou via cookie). */
export async function resoudreRemiseAbonne(
  admin: SupabaseClient,
  beatmaker: BeatmakerPourPrix,
  user: UtilisateurPourPrix,
  slug: string,
): Promise<number> {
  if (!beatmaker.abo_actif) return 0

  if (user) {
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .eq('statut', 'actif')
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .maybeSingle()
    if (abo && beatmaker.abo_remise_pct) return beatmaker.abo_remise_pct
  }

  const cookieStore = await cookies()
  const emailCookie = cookieStore.get(`abo_${slug}`)?.value
  if (emailCookie) {
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .eq('acheteur_email', emailCookie)
      .eq('statut', 'actif')
      .maybeSingle()
    if (abo && beatmaker.abo_remise_pct) return beatmaker.abo_remise_pct
  }

  return 0
}

/** Valide intégralement un code promo (dates, restrictions email, limites d'utilisation). */
export async function validerCodePromo(
  admin: SupabaseClient,
  beatmaker: BeatmakerPourPrix,
  codePromo: string | undefined,
  user: UtilisateurPourPrix,
  emailAcheteur: string | undefined,
): Promise<ResultatPrix<{ promo: Record<string, unknown>; codePromoValide: string } | null>> {
  if (!codePromo) return { ok: true, value: null }

  const emailEffectif = user?.email ?? emailAcheteur ?? null

  const { data: promoData } = await admin
    .from('codes_promo')
    .select('*')
    .eq('beatmaker_id', beatmaker.id)
    .eq('code', codePromo.toUpperCase().trim())
    .eq('statut', 'actif')
    .single()

  if (!promoData) return { ok: false, erreur: 'Code promo invalide', status: 400 }
  if (promoData.type_remise === 'abonnement') {
    return { ok: false, erreur: 'Ce code est réservé aux abonnements', status: 400 }
  }

  const now = new Date()
  if (promoData.date_debut && new Date(promoData.date_debut) > now) {
    return { ok: false, erreur: "Ce code n'est pas encore actif", status: 400 }
  }
  if (promoData.date_expiration && new Date(promoData.date_expiration) < now) {
    return { ok: false, erreur: 'Ce code a expiré', status: 400 }
  }
  if (promoData.limite_par_code !== null && promoData.utilisations >= promoData.limite_par_code) {
    return { ok: false, erreur: "Ce code a atteint sa limite d'utilisation", status: 400 }
  }
  if (promoData.emails_autorises?.length > 0) {
    if (!emailEffectif || !promoData.emails_autorises.includes(emailEffectif)) {
      return { ok: false, erreur: 'Code non autorisé pour cette adresse email', status: 400 }
    }
  }
  if (emailEffectif && promoData.emails_exclus?.includes(emailEffectif)) {
    return { ok: false, erreur: 'Code non autorisé pour cette adresse email', status: 400 }
  }
  if (user?.email && promoData.premiere_commande) {
    const { data: commandeExistante } = await admin
      .from('commandes')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .eq('statut', 'payee')
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .limit(1)
      .maybeSingle()
    if (commandeExistante) {
      return { ok: false, erreur: 'Ce code est réservé aux nouveaux clients', status: 400 }
    }
  }
  if (user?.email) {
    const limiteParUser = promoData.limite_par_utilisateur ?? (promoData.utilisation_individuelle ? 1 : null)
    if (limiteParUser !== null) {
      const { count } = await admin
        .from('commandes')
        .select('id', { count: 'exact', head: true })
        .eq('beatmaker_id', beatmaker.id)
        .eq('code_promo', codePromo.toUpperCase().trim())
        .eq('statut', 'payee')
        .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      if ((count ?? 0) >= limiteParUser) {
        return { ok: false, erreur: 'Vous avez déjà utilisé ce code', status: 400 }
      }
    }
  }

  return { ok: true, value: { promo: promoData, codePromoValide: codePromo.toUpperCase().trim() } }
}

/** Recalcule le prix de chaque article du panier à partir de beat_id/licence_id (jamais du prix envoyé par le front). */
export async function calculerLignesPanier(
  admin: SupabaseClient,
  beatmaker: BeatmakerPourPrix,
  items: ItemPanier[],
  ctx: { remisePct: number; promo: Record<string, unknown> | null },
): Promise<ResultatPrix<LigneCalculee[]>> {
  const beatIds = [...new Set(items.map(i => i.beat_id))]

  const { data: beatsData } = await admin
    .from('beats')
    .select('id, titre, image_url, beatmaker_id')
    .in('id', beatIds)
    .in('statut', ['public', 'prive'])
    .is('supprime_le', null)

  const beatMap = new Map((beatsData ?? []).map(b => [b.id, b]))

  const { data: beatLicencesData, error: beatLicencesError } = await admin
    .from('beat_licences')
    .select('beat_id, licence_id, actif, prix_override, sur_demande, licences(id, nom, modele, prix, actif)')
    .in('beat_id', beatIds)

  if (beatLicencesError) console.error('[pricing] Erreur query beat_licences:', JSON.stringify(beatLicencesError))

  type LicenceRow = { id: string; nom: string; modele: string; prix: number; actif: boolean }
  const beatLicenceMap = new Map(
    (beatLicencesData ?? []).map(bl => [`${bl.beat_id}:${bl.licence_id}`, bl])
  )

  const lignes: LigneCalculee[] = []

  for (const item of items) {
    const beat = beatMap.get(item.beat_id)
    if (!beat || String(beat.beatmaker_id) !== String(beatmaker.id)) {
      return { ok: false, erreur: 'Beat introuvable', status: 404 }
    }

    const beatLicence = beatLicenceMap.get(`${item.beat_id}:${item.licence_id}`)
    if (!beatLicence) {
      return { ok: false, erreur: `Combinaison beat/licence introuvable pour "${beat.titre}"`, status: 400 }
    }
    if (!beatLicence.actif) {
      return { ok: false, erreur: `Licence désactivée pour "${beat.titre}"`, status: 400 }
    }
    if (beatLicence.sur_demande) {
      return { ok: false, erreur: `Licence sur demande (non achetable directement) pour "${beat.titre}"`, status: 400 }
    }
    const licence = beatLicence.licences as unknown as LicenceRow
    if (!licence?.actif) {
      return { ok: false, erreur: `Licence inactive pour "${beat.titre}"`, status: 400 }
    }

    // Illimité/exclusive n'acceptent pas la remise abonné automatique (décision
    // produit d'origine) — mais un code promo reste un choix explicite du
    // beatmaker par code (via licences_eligibles), pas une exclusion globale.
    const estIllimite = licence.modele === 'illimite' || licence.modele === 'exclusive'
    const prixBaseHT = (beatLicence.prix_override ?? licence.prix) * 100
    const remisePctItem = estIllimite ? 0 : ctx.remisePct
    let prixApresRemise = remisePctItem > 0 ? Math.round(prixBaseHT * (1 - remisePctItem / 100)) : prixBaseHT

    let reductionCodeCents = 0
    let codePromoAppliqueItem = false

    if (ctx.promo) {
      const promo = ctx.promo
      const beatsInclus = promo.beats_inclus as string[] | null
      const beatsExclus = promo.beats_exclus as string[] | null
      const licencesEligibles = promo.licences_eligibles as string[] | null
      const depenseMin = promo.depense_min as number | null
      const depenseMax = promo.depense_max as number | null

      const eligible =
        (!beatsInclus?.length || beatsInclus.includes(item.beat_id)) &&
        !beatsExclus?.includes(item.beat_id) &&
        (!licencesEligibles?.length || licencesEligibles.includes(licence.nom)) &&
        (!depenseMin || (prixApresRemise / 100) >= Number(depenseMin)) &&
        (!depenseMax || (prixApresRemise / 100) <= Number(depenseMax))

      if (eligible) {
        if (promo.type_valeur === 'pourcentage') {
          reductionCodeCents = Math.round(prixApresRemise * Number(promo.valeur) / 100)
        } else {
          reductionCodeCents = Math.min(Math.round(Number(promo.valeur) * 100), prixApresRemise)
        }
        prixApresRemise = Math.max(0, prixApresRemise - reductionCodeCents)
        codePromoAppliqueItem = true
      }
    }

    const tvaMultiplier = beatmaker.tva_active && beatmaker.tva_taux ? beatmaker.tva_taux / 100 : 0
    const prixTotal = Math.round(prixApresRemise * (1 + tvaMultiplier))

    lignes.push({
      beat_id: item.beat_id,
      licence_id: item.licence_id,
      titre: beat.titre,
      image_url: beat.image_url,
      nomLicence: licence.nom,
      prixTotalCents: prixTotal,
      reductionCodeCents,
      codePromoApplique: codePromoAppliqueItem,
    })
  }

  // Un code promo saisi doit s'appliquer à au moins un article du panier
  if (ctx.promo && !lignes.some(l => l.codePromoApplique)) {
    return { ok: false, erreur: "Ce code ne s'applique à aucun article du panier", status: 400 }
  }

  return { ok: true, value: lignes }
}
