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
  reductionLotId: string | null
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

/**
 * `client_id` sur tentatives_paiement/commandes référence clients(id), qui
 * référence lui-même auth.users(id) — mais un beatmaker connecté a AUSSI une
 * session auth.users valide sans jamais avoir de ligne dans `clients` (deux
 * types de comptes distincts). Utiliser `user.id` tel quel comme client_id
 * dans ce cas viole la contrainte de clé étrangère et fait échouer l'insert
 * en silence (caught + console.error, jamais renvoyé au front) : le paiement
 * Stripe réussit mais aucune commande n'est jamais créée. Toujours vérifier
 * l'existence réelle de la ligne clients avant de l'utiliser comme FK.
 */
export async function resoudreClientId(admin: SupabaseClient, user: UtilisateurPourPrix): Promise<string | null> {
  if (!user) return null
  const { data } = await admin.from('clients').select('id').eq('id', user.id).maybeSingle()
  return data?.id ?? null
}

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

type LicenceRow = { id: string; nom: string; modele: string; prix: number; actif: boolean }

type LigneIntermediaire = {
  index: number
  item: ItemPanier
  titre: string
  image_url: string | null
  licence: LicenceRow
  prixApresRemise: number // après remise abonné, avant code promo / réduction par lot
}

/** Recalcule le prix de chaque article du panier à partir de beat_id/licence_id (jamais du prix envoyé par le front). */
export async function calculerLignesPanier(
  admin: SupabaseClient,
  beatmaker: BeatmakerPourPrix,
  items: ItemPanier[],
  ctx: { remisePct: number; promo: Record<string, unknown> | null },
): Promise<ResultatPrix<LigneCalculee[]>> {
  const beatIds = [...new Set(items.map(i => i.beat_id))]
  const licenceIds = [...new Set(items.map(i => i.licence_id))]

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

  const beatLicenceMap = new Map(
    (beatLicencesData ?? []).map(bl => [`${bl.beat_id}:${bl.licence_id}`, bl])
  )

  // Règles de réduction par lot actives du beatmaker, pour les licences présentes
  // dans ce panier (une règle = une licence, une seule active par licence — cf.
  // supabase/reductions_lot.sql).
  const { data: reductionsLotData, error: reductionsLotError } = await admin
    .from('reductions_lot')
    .select('id, licence_id, nb_a_acheter, nb_offerts')
    .eq('beatmaker_id', beatmaker.id)
    .eq('actif', true)
    .in('licence_id', licenceIds)

  if (reductionsLotError) console.error('[pricing] Erreur query reductions_lot:', JSON.stringify(reductionsLotError))

  type ReductionLotRow = { id: string; licence_id: string; nb_a_acheter: number; nb_offerts: number }
  const reductionsLotParLicence = new Map(
    (reductionsLotData as ReductionLotRow[] | null ?? []).map(r => [r.licence_id, r])
  )

  // Passe 1 — résout beat/licence + prix après remise abonné uniquement.
  const intermediaires: LigneIntermediaire[] = []

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
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
    const prixApresRemise = remisePctItem > 0 ? Math.round(prixBaseHT * (1 - remisePctItem / 100)) : prixBaseHT

    intermediaires.push({ index, item, titre: beat.titre, image_url: beat.image_url, licence, prixApresRemise })
  }

  // Passe 2 — groupe par licence et détermine les articles offerts. Article
  // offert = le moins cher parmi les éligibles ; à prix égal, le dernier
  // ajouté au panier (index le plus grand) — décision produit 2026-08-05.
  const groupesParLicence = new Map<string, LigneIntermediaire[]>()
  for (const ligne of intermediaires) {
    const groupe = groupesParLicence.get(ligne.item.licence_id) ?? []
    groupe.push(ligne)
    groupesParLicence.set(ligne.item.licence_id, groupe)
  }

  const reductionLotParIndex = new Map<number, string>()

  for (const [licenceId, groupe] of groupesParLicence) {
    const regle = reductionsLotParLicence.get(licenceId)
    if (!regle) continue
    const tailleLot = regle.nb_a_acheter + regle.nb_offerts
    const nbOffertsTotal = Math.floor(groupe.length / tailleLot) * regle.nb_offerts
    if (nbOffertsTotal === 0) continue

    const trie = [...groupe].sort((a, b) => a.prixApresRemise - b.prixApresRemise || b.index - a.index)
    for (const ligne of trie.slice(0, nbOffertsTotal)) {
      reductionLotParIndex.set(ligne.index, regle.id)
    }
  }

  // Un code promo marqué non-cumulable (par code, cf. codes_promo.cumulable_reduction_lot)
  // est refusé dès qu'une réduction par lot s'est effectivement déclenchée sur ce panier.
  const promoNonCumulable = ctx.promo
    ? (ctx.promo as { cumulable_reduction_lot?: boolean }).cumulable_reduction_lot === false
    : false
  if (promoNonCumulable && reductionLotParIndex.size > 0) {
    return { ok: false, erreur: 'Ce code ne peut pas être cumulé avec la réduction par lot active sur ce panier', status: 400 }
  }

  // Passe 3 — applique le code promo (jamais sur un article déjà offert) et la TVA.
  const lignes: LigneCalculee[] = []

  for (const ligne of intermediaires) {
    const reductionLotId = reductionLotParIndex.get(ligne.index) ?? null
    let prixApresRemise = reductionLotId ? 0 : ligne.prixApresRemise

    let reductionCodeCents = 0
    let codePromoAppliqueItem = false

    if (!reductionLotId && ctx.promo) {
      const promo = ctx.promo
      const beatsInclus = promo.beats_inclus as string[] | null
      const beatsExclus = promo.beats_exclus as string[] | null
      const licencesEligibles = promo.licences_eligibles as string[] | null
      const depenseMin = promo.depense_min as number | null
      const depenseMax = promo.depense_max as number | null

      const eligible =
        (!beatsInclus?.length || beatsInclus.includes(ligne.item.beat_id)) &&
        !beatsExclus?.includes(ligne.item.beat_id) &&
        (!licencesEligibles?.length || licencesEligibles.includes(ligne.licence.nom)) &&
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
      beat_id: ligne.item.beat_id,
      licence_id: ligne.item.licence_id,
      titre: ligne.titre,
      image_url: ligne.image_url,
      nomLicence: ligne.licence.nom,
      prixTotalCents: prixTotal,
      reductionCodeCents,
      codePromoApplique: codePromoAppliqueItem,
      reductionLotId,
    })
  }

  // Un code promo saisi doit s'appliquer à au moins un article du panier
  if (ctx.promo && !lignes.some(l => l.codePromoApplique)) {
    return { ok: false, erreur: "Ce code ne s'applique à aucun article du panier", status: 400 }
  }

  return { ok: true, value: lignes }
}
