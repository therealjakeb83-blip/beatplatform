import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const { beat_id, licence_id, slug, code_promo } = await request.json()

  if (!beat_id || !licence_id || !slug) {
    return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: beat } = await supabase
    .from('beats')
    .select('id, titre, image_url, beatmaker_id, beatmakers(stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct)')
    .eq('id', beat_id)
    .in('statut', ['public', 'prive'])
    .is('supprime_le', null)
    .single()

  if (!beat) return NextResponse.json({ erreur: 'Beat introuvable' }, { status: 404 })

  const { data: beatLicence } = await supabase
    .from('beat_licences')
    .select('actif, prix_override, sur_demande, licences(id, nom, modele, prix, actif)')
    .eq('beat_id', beat_id)
    .eq('licence_id', licence_id)
    .single()

  if (!beatLicence?.actif || beatLicence.sur_demande) {
    return NextResponse.json({ erreur: 'Licence indisponible' }, { status: 400 })
  }

  type LicenceRow = { id: string; nom: string; modele: string; prix: number; actif: boolean }
  const licence = beatLicence.licences as unknown as LicenceRow
  if (!licence?.actif) return NextResponse.json({ erreur: 'Licence inactive' }, { status: 400 })

  type BeatmakerRow = { stripe_account_id: string | null; tva_active: boolean; tva_taux: number | null; abo_remise_pct: number | null; abo_actif: boolean }
  let beatmaker = (beat as unknown as { beatmakers: BeatmakerRow }).beatmakers

  // Fallback admin si l'artiste connecté ne peut pas lire le JOIN beatmakers via RLS
  if (!beatmaker) {
    const admin = createAdminClient()
    const { data: bm } = await admin
      .from('beatmakers')
      .select('stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct')
      .eq('id', beat.beatmaker_id)
      .single()
    beatmaker = bm as unknown as BeatmakerRow
  }

  if (!beatmaker) return NextResponse.json({ erreur: 'Beatmaker introuvable' }, { status: 404 })

  const prixBaseHT = (beatLicence.prix_override ?? licence.prix) * 100

  // Remise membre si abonné (sauf licence Illimité/Exclusive)
  let remisePct = 0
  const estIllimite = licence.modele === 'illimite' || licence.modele === 'exclusive'
  if (beatmaker.abo_actif && !estIllimite) {
    const adminAbo = createAdminClient()
    if (user) {
      const { data: abo } = await adminAbo
        .from('abonnements_boutique')
        .select('id')
        .eq('beatmaker_id', String(beat.beatmaker_id))
        .eq('statut', 'actif')
        .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
        .maybeSingle()
      if (abo && beatmaker.abo_remise_pct) remisePct = beatmaker.abo_remise_pct
    }

    if (remisePct === 0) {
      const cookieStore = await cookies()
      const emailCookie = cookieStore.get(`abo_${slug}`)?.value
      if (emailCookie) {
        const { data: abo } = await adminAbo
          .from('abonnements_boutique')
          .select('id')
          .eq('beatmaker_id', String(beat.beatmaker_id))
          .eq('acheteur_email', emailCookie)
          .eq('statut', 'actif')
          .maybeSingle()
        if (abo && beatmaker.abo_remise_pct) remisePct = beatmaker.abo_remise_pct
      }
    }
  }

  let prixApresRemise = remisePct > 0 ? Math.round(prixBaseHT * (1 - remisePct / 100)) : prixBaseHT

  // Application du code promo (panier / produit uniquement — abonnements gérés par Stripe)
  let reductionCodeCents = 0
  let codePromoValide: string | null = null

  if (code_promo && !estIllimite) {
    const adminCode = createAdminClient()
    const { data: promo } = await adminCode
      .from('codes_promo')
      .select('*')
      .eq('beatmaker_id', String(beat.beatmaker_id))
      .eq('code', (code_promo as string).toUpperCase().trim())
      .eq('statut', 'actif')
      .single()

    if (!promo) {
      return NextResponse.json({ erreur: 'Code promo invalide' }, { status: 400 })
    }

    if (promo.type_remise === 'abonnement') {
      return NextResponse.json({ erreur: 'Ce code est réservé aux abonnements' }, { status: 400 })
    }

    const now = new Date()
    if (promo.date_debut && new Date(promo.date_debut) > now) {
      return NextResponse.json({ erreur: "Ce code n'est pas encore actif" }, { status: 400 })
    }
    if (promo.date_expiration && new Date(promo.date_expiration) < now) {
      return NextResponse.json({ erreur: 'Ce code a expiré' }, { status: 400 })
    }

    if (promo.beats_inclus?.length > 0 && !promo.beats_inclus.includes(beat_id)) {
      return NextResponse.json({ erreur: 'Code non applicable à ce beat' }, { status: 400 })
    }
    if (promo.beats_exclus?.includes(beat_id)) {
      return NextResponse.json({ erreur: 'Code non applicable à ce beat' }, { status: 400 })
    }

    if (promo.licences_eligibles?.length > 0 && !promo.licences_eligibles.includes(licence.modele)) {
      return NextResponse.json({ erreur: 'Code non applicable à cette licence' }, { status: 400 })
    }

    // depense_min / max comparés en euros (prixApresRemise est en centimes)
    const prixEuros = prixApresRemise / 100
    if (promo.depense_min && prixEuros < Number(promo.depense_min)) {
      return NextResponse.json({ erreur: `Montant minimum requis : ${promo.depense_min}€` }, { status: 400 })
    }
    if (promo.depense_max && prixEuros > Number(promo.depense_max)) {
      return NextResponse.json({ erreur: 'Code non applicable (montant trop élevé)' }, { status: 400 })
    }

    if (promo.limite_par_code !== null && promo.utilisations >= promo.limite_par_code) {
      return NextResponse.json({ erreur: "Ce code a atteint sa limite d'utilisation" }, { status: 400 })
    }

    // Vérifications liées à l'utilisateur connecté
    if (user?.email) {
      if (promo.emails_autorises?.length > 0 && !promo.emails_autorises.includes(user.email)) {
        return NextResponse.json({ erreur: 'Code non autorisé pour votre compte' }, { status: 400 })
      }
      if (promo.emails_exclus?.includes(user.email)) {
        return NextResponse.json({ erreur: 'Code non autorisé pour votre compte' }, { status: 400 })
      }

      if (promo.premiere_commande) {
        const { data: commandeExistante } = await adminCode
          .from('commandes')
          .select('id')
          .eq('beatmaker_id', String(beat.beatmaker_id))
          .eq('statut', 'payee')
          .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
          .limit(1)
          .maybeSingle()
        if (commandeExistante) {
          return NextResponse.json({ erreur: 'Ce code est réservé aux nouveaux clients' }, { status: 400 })
        }
      }

      const limiteParUser = promo.limite_par_utilisateur ?? (promo.utilisation_individuelle ? 1 : null)
      if (limiteParUser !== null) {
        const { count } = await adminCode
          .from('commandes')
          .select('id', { count: 'exact', head: true })
          .eq('beatmaker_id', String(beat.beatmaker_id))
          .eq('code_promo', (code_promo as string).toUpperCase().trim())
          .eq('statut', 'payee')
          .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
        if ((count ?? 0) >= limiteParUser) {
          return NextResponse.json({ erreur: 'Vous avez déjà utilisé ce code' }, { status: 400 })
        }
      }
    }

    // Calcul de la réduction
    if (promo.type_valeur === 'pourcentage') {
      reductionCodeCents = Math.round(prixApresRemise * Number(promo.valeur) / 100)
    } else {
      reductionCodeCents = Math.min(Math.round(Number(promo.valeur) * 100), prixApresRemise)
    }
    codePromoValide = (code_promo as string).toUpperCase().trim()
    prixApresRemise = Math.max(0, prixApresRemise - reductionCodeCents)
  }

  const tvaMultiplier = beatmaker.tva_active && beatmaker.tva_taux ? beatmaker.tva_taux / 100 : 0
  const prixTotal = Math.round(prixApresRemise * (1 + tvaMultiplier))

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${beat.titre} — ${licence.nom}`,
          ...(beat.image_url ? { images: [beat.image_url] } : {}),
        },
        unit_amount: prixTotal,
      },
      quantity: 1,
    }],
    billing_address_collection: 'required',
    success_url: `${origin}/${slug}/${beat_id}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${slug}/${beat_id}`,
    metadata: {
      beat_id,
      licence_id,
      beatmaker_id: String(beat.beatmaker_id),
      slug,
      prix_ht: String(prixBaseHT),
      remise_pct: String(remisePct),
      ...(codePromoValide ? {
        code_promo: codePromoValide,
        reduction_code_promo: String(reductionCodeCents),
      } : {}),
    },
  }

  const adminForSplits = createAdminClient()
  const { data: beatSplits } = await adminForSplits
    .from('beat_splits')
    .select('id')
    .eq('beat_id', beat_id)

  const hasSplits = beatSplits && beatSplits.length > 0

  if (hasSplits) {
    const transferGroup = crypto.randomUUID()
    sessionParams.payment_intent_data = {
      transfer_group: transferGroup,
    }
    sessionParams.metadata = {
      ...sessionParams.metadata,
      transfer_group: transferGroup,
      has_splits: 'true',
    }
  } else if (beatmaker.stripe_account_id) {
    sessionParams.payment_intent_data = {
      application_fee_amount: 0,
      on_behalf_of: beatmaker.stripe_account_id,
      transfer_data: { destination: beatmaker.stripe_account_id },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  return NextResponse.json({ url: session.url })
}
