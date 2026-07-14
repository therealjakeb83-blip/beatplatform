import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { verifierTokenCampagne, COOKIE_CLIC } from '@/lib/mailing'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

type ItemPanier = { beat_id: string; licence_id: string }

type LigneCalculee = {
  beat_id: string
  licence_id: string
  titre: string
  image_url: string | null
  nomLicence: string
  prixTotalCents: number
  reductionCodeCents: number
  codePromoApplique: boolean
}

export async function POST(request: Request) {
  const { items, slug, code_promo, email_acheteur, source_marketing } = await request.json() as {
    items?: ItemPanier[]
    slug?: string
    code_promo?: string
    email_acheteur?: string
    source_marketing?: string
  }

  if (!slug || !items?.length) {
    return NextResponse.json({ erreur: 'Panier vide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: beatmakerRow } = await supabase
    .from('beatmakers')
    .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct')
    .eq('slug', slug)
    .single()

  type BeatmakerRow = { id: string; stripe_account_id: string | null; tva_active: boolean; tva_taux: number | null; abo_remise_pct: number | null; abo_actif: boolean }
  let beatmaker = beatmakerRow as BeatmakerRow | null

  // Fallback admin si l'artiste connecté ne peut pas lire beatmakers via RLS
  if (!beatmaker) {
    const admin = createAdminClient()
    const { data: bm } = await admin
      .from('beatmakers')
      .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct')
      .eq('slug', slug)
      .single()
    beatmaker = bm as BeatmakerRow | null
  }

  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  const admin = createAdminClient()
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

  if (beatLicencesError) console.error('[checkout] Erreur query beat_licences:', JSON.stringify(beatLicencesError))

  type LicenceRow = { id: string; nom: string; modele: string; prix: number; actif: boolean }
  const beatLicenceMap = new Map(
    (beatLicencesData ?? []).map(bl => [`${bl.beat_id}:${bl.licence_id}`, bl])
  )

  // Remise membre si abonné (partagée par tous les articles éligibles du panier)
  let remisePct = 0
  if (beatmaker.abo_actif) {
    if (user) {
      const { data: abo } = await admin
        .from('abonnements_boutique')
        .select('id')
        .eq('beatmaker_id', beatmaker.id)
        .eq('statut', 'actif')
        .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
        .maybeSingle()
      if (abo && beatmaker.abo_remise_pct) remisePct = beatmaker.abo_remise_pct
    }
    if (remisePct === 0) {
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
        if (abo && beatmaker.abo_remise_pct) remisePct = beatmaker.abo_remise_pct
      }
    }
  }

  // Code promo — validé une fois pour tout le panier, appliqué article par article
  let promo: Record<string, unknown> | null = null
  let codePromoValide: string | null = null
  const emailEffectif = user?.email ?? (email_acheteur as string | undefined) ?? null

  if (code_promo) {
    const { data: promoData } = await admin
      .from('codes_promo')
      .select('*')
      .eq('beatmaker_id', beatmaker.id)
      .eq('code', (code_promo as string).toUpperCase().trim())
      .eq('statut', 'actif')
      .single()

    if (!promoData) return NextResponse.json({ erreur: 'Code promo invalide' }, { status: 400 })
    if (promoData.type_remise === 'abonnement') {
      return NextResponse.json({ erreur: 'Ce code est réservé aux abonnements' }, { status: 400 })
    }

    const now = new Date()
    if (promoData.date_debut && new Date(promoData.date_debut) > now) {
      return NextResponse.json({ erreur: "Ce code n'est pas encore actif" }, { status: 400 })
    }
    if (promoData.date_expiration && new Date(promoData.date_expiration) < now) {
      return NextResponse.json({ erreur: 'Ce code a expiré' }, { status: 400 })
    }
    if (promoData.limite_par_code !== null && promoData.utilisations >= promoData.limite_par_code) {
      return NextResponse.json({ erreur: "Ce code a atteint sa limite d'utilisation" }, { status: 400 })
    }
    if (promoData.emails_autorises?.length > 0) {
      if (!emailEffectif || !promoData.emails_autorises.includes(emailEffectif)) {
        return NextResponse.json({ erreur: 'Code non autorisé pour cette adresse email' }, { status: 400 })
      }
    }
    if (emailEffectif && promoData.emails_exclus?.includes(emailEffectif)) {
      return NextResponse.json({ erreur: 'Code non autorisé pour cette adresse email' }, { status: 400 })
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
        return NextResponse.json({ erreur: 'Ce code est réservé aux nouveaux clients' }, { status: 400 })
      }
    }
    if (user?.email) {
      const limiteParUser = promoData.limite_par_utilisateur ?? (promoData.utilisation_individuelle ? 1 : null)
      if (limiteParUser !== null) {
        const { count } = await admin
          .from('commandes')
          .select('id', { count: 'exact', head: true })
          .eq('beatmaker_id', beatmaker.id)
          .eq('code_promo', (code_promo as string).toUpperCase().trim())
          .eq('statut', 'payee')
          .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
        if ((count ?? 0) >= limiteParUser) {
          return NextResponse.json({ erreur: 'Vous avez déjà utilisé ce code' }, { status: 400 })
        }
      }
    }

    promo = promoData
    codePromoValide = (code_promo as string).toUpperCase().trim()
  }

  // Calcul par article
  const lignes: LigneCalculee[] = []

  for (const item of items) {
    const beat = beatMap.get(item.beat_id)
    if (!beat || String(beat.beatmaker_id) !== String(beatmaker.id)) {
      return NextResponse.json({ erreur: 'Beat introuvable' }, { status: 404 })
    }

    const beatLicence = beatLicenceMap.get(`${item.beat_id}:${item.licence_id}`)
    if (!beatLicence) {
      return NextResponse.json({ erreur: `Combinaison beat/licence introuvable pour "${beat.titre}"` }, { status: 400 })
    }
    if (!beatLicence.actif) {
      return NextResponse.json({ erreur: `Licence désactivée pour "${beat.titre}"` }, { status: 400 })
    }
    if (beatLicence.sur_demande) {
      return NextResponse.json({ erreur: `Licence sur demande (non achetable directement) pour "${beat.titre}"` }, { status: 400 })
    }
    const licence = beatLicence.licences as unknown as LicenceRow
    if (!licence?.actif) {
      return NextResponse.json({ erreur: `Licence inactive pour "${beat.titre}"` }, { status: 400 })
    }

    // Illimité/exclusive n'acceptent pas la remise abonné automatique (décision
    // produit d'origine) — mais un code promo reste un choix explicite du
    // beatmaker par code (via licences_eligibles), pas une exclusion globale.
    const estIllimite = licence.modele === 'illimite' || licence.modele === 'exclusive'
    const prixBaseHT = (beatLicence.prix_override ?? licence.prix) * 100
    const remisePctItem = estIllimite ? 0 : remisePct
    let prixApresRemise = remisePctItem > 0 ? Math.round(prixBaseHT * (1 - remisePctItem / 100)) : prixBaseHT

    let reductionCodeCents = 0
    let codePromoAppliqueItem = false

    if (promo) {
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
  if (promo && !lignes.some(l => l.codePromoApplique)) {
    return NextResponse.json({ erreur: "Ce code ne s'applique à aucun article du panier" }, { status: 400 })
  }

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const cookieClic = (await cookies()).get(COOKIE_CLIC)?.value
  const verifClic = cookieClic ? verifierTokenCampagne(cookieClic) : null
  const attributionCampagne = verifClic && verifClic.beatmakerId === String(beatmaker.id) ? verifClic : null

  // Répartition des fonds : si au moins un article a des splits, toute la
  // session bascule en mode "fonds retenus + transferts manuels par article"
  // (les articles sans split de ce même panier reçoivent alors 100% par transfert
  // plutôt qu'une destination charge directe — cf plan Phase 2c).
  const { data: splitsData } = await admin
    .from('beat_splits')
    .select('beat_id')
    .in('beat_id', beatIds)
  const hasSplits = (splitsData?.length ?? 0) > 0

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lignes.map(l => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${l.titre} — ${l.nomLicence}`,
          ...(l.image_url ? { images: [l.image_url] } : {}),
        },
        unit_amount: l.prixTotalCents,
      },
      quantity: 1,
    })),
    billing_address_collection: 'required',
    success_url: `${origin}/${slug}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${slug}`,
    metadata: {
      beatmaker_id: String(beatmaker.id),
      slug,
      source_marketing: source_marketing ?? 'direct',
      ...(codePromoValide ? { code_promo: codePromoValide } : {}),
      ...(attributionCampagne ? {
        campagne_id: attributionCampagne.campagneId,
        campagne_client_id: attributionCampagne.clientId,
      } : {}),
    },
  }

  if (hasSplits) {
    const transferGroup = crypto.randomUUID()
    sessionParams.payment_intent_data = { transfer_group: transferGroup }
    sessionParams.metadata = { ...sessionParams.metadata, transfer_group: transferGroup, has_splits: 'true' }
  } else if (beatmaker.stripe_account_id) {
    sessionParams.payment_intent_data = {
      application_fee_amount: 0,
      on_behalf_of: beatmaker.stripe_account_id,
      transfer_data: { destination: beatmaker.stripe_account_id },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  const prixTotalEuros = lignes.reduce((s, l) => s + l.prixTotalCents, 0) / 100

  const { data: tentative, error: tentativeError } = await admin.from('tentatives_paiement').insert({
    beatmaker_id: beatmaker.id,
    client_id: user?.id ?? null,
    email: user?.email ?? email_acheteur ?? null,
    prix: prixTotalEuros,
    code_promo: codePromoValide,
    source_marketing: source_marketing ?? 'direct',
    stripe_session_id: session.id,
    statut: 'creee',
  }).select('id').single()

  if (tentativeError) {
    console.error('[checkout] Erreur insert tentative_paiement:', JSON.stringify(tentativeError))
  } else if (tentative) {
    const { error: lignesError } = await admin.from('tentatives_paiement_lignes').insert(
      lignes.map(l => ({
        tentative_id: tentative.id,
        beat_id: l.beat_id,
        licence_id: l.licence_id,
        prix: l.prixTotalCents / 100,
        reduction_montant: l.reductionCodeCents / 100,
        code_promo_applique: l.codePromoApplique,
      }))
    )
    if (lignesError) console.error('[checkout] Erreur insert tentatives_paiement_lignes:', JSON.stringify(lignesError))
  }

  return NextResponse.json({ url: session.url })
}
