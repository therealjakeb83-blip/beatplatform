import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreRemiseAbonne, validerCodePromo, calculerLignesPanier, resoudreClientId, type ItemPanier } from '@/lib/pricing'
import { calculerPretAVendre } from '@/lib/pret-a-vendre'
import { estRoleAdmin } from '@/lib/admin'
import { normaliserEmail } from '@/lib/email'
import { panierEstMultiVendeurs, repartirPanier } from '@/lib/paiement-multi-repartition'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Paiement réparti entre vendeurs (Phase 13, lot 1) — étape 1 : prix recalculé
// côté serveur, répartition par vendeur, puis SetupIntent sur la plateforme
// (enregistrement de la carte, AUCUN argent). Le navigateur confirme ce
// SetupIntent puis appelle /api/stripe/paiement-multi/payer. Apple Pay /
// Google Pay (lot 2) : le moyen déjà créé par le navigateur est enregistré
// ici directement. Jamais Link : Stripe refuse de le copier chez un vendeur.
export async function POST(request: Request) {
  const body = await request.json() as {
    items?: ItemPanier[]
    slug?: string
    code_promo?: string
    email_acheteur?: string
    source_marketing?: string
    prenom?: string
    nom?: string
    telephone?: string
    adresse?: string
    code_postal?: string
    ville?: string
    pays?: string
    type_client?: 'particulier' | 'professionnel'
    raison_sociale?: string
    numero_tva?: string
    newsletter_opt_in?: boolean
    // Apple Pay / Google Pay (lot 2) : moyen de paiement déjà créé par
    // le navigateur sur la plateforme — enregistré ici, jamais débité.
    payment_method_id?: string
  }
  const { slug, code_promo, source_marketing, prenom, nom, telephone, adresse, code_postal, ville, pays, type_client, raison_sociale, numero_tva, newsletter_opt_in } = body
  const items = body.items ?? []
  if (!slug || !items.length) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, stripe_account_id, tva_active, tva_taux, abo_actif, abo_remise_pct, role, abonnement_exempte')
    .eq('slug', slug)
    .single()
  if (!beatmaker) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })

  if (!(estRoleAdmin(beatmaker.role) || beatmaker.abonnement_exempte)) {
    const readiness = await calculerPretAVendre(admin, beatmaker.id, { estConcedant: true })
    if (!readiness.pret) {
      return NextResponse.json({ erreur: 'Cette boutique n\'est pas encore prête à vendre — réessaie plus tard.' }, { status: 400 })
    }
  }

  const emailAcheteur = normaliserEmail(user?.email ?? body.email_acheteur ?? '') || null
  const remisePct = await resoudreRemiseAbonne(admin, beatmaker, user, slug)
  const promoResult = await validerCodePromo(admin, beatmaker, code_promo, user, emailAcheteur ?? undefined)
  if (!promoResult.ok) return NextResponse.json({ erreur: promoResult.erreur }, { status: promoResult.status })
  const codePromoValide = promoResult.value?.codePromoValide ?? null

  const lignesResult = await calculerLignesPanier(admin, beatmaker, items, { remisePct, promo: promoResult.value?.promo ?? null })
  if (!lignesResult.ok) return NextResponse.json({ erreur: lignesResult.erreur }, { status: lignesResult.status })
  const lignes = lignesResult.value
  if (!panierEstMultiVendeurs(lignes)) {
    return NextResponse.json({ erreur: 'Ce panier se paie avec le paiement habituel.' }, { status: 400 })
  }

  const tranches = repartirPanier(lignes, String(beatmaker.id)).filter(t => t.montant_cents > 0)
  if (tranches.some(t => t.montant_cents < 50)) {
    return NextResponse.json({ erreur: 'Montant trop faible pour ce panier.' }, { status: 400 })
  }

  const { data: comptes } = await admin.from('beatmakers').select('id, stripe_account_id').in('id', tranches.map(t => t.vendeur_id))
  const compteParVendeur = new Map((comptes ?? []).map(c => [c.id as string, c.stripe_account_id as string | null]))
  if (tranches.some(t => !compteParVendeur.get(t.vendeur_id))) {
    return NextResponse.json({ erreur: 'Un beat de ton panier n’est plus disponible pour le moment.' }, { status: 409 })
  }

  const totalCents = lignes.reduce((s, l) => s + l.prixTotalCents, 0)
  const nomComplet = [prenom, nom].filter(Boolean).join(' ') || undefined

  // Carte seulement (Apple Pay / Google Pay en sont) : Stripe refuse de copier
  // un moyen Link chez un vendeur (« cannot be shared to a sub-account », T14).
  if (body.payment_method_id) {
    const pm = await stripe.paymentMethods.retrieve(body.payment_method_id).catch(() => null)
    if (!pm || pm.customer || pm.type !== 'card') {
      return NextResponse.json({ erreur: 'Ce moyen de paiement n’est pas accepté pour un beat en collaboration : utilise une carte, Apple Pay ou Google Pay.' }, { status: 400 })
    }
  }

  const customer = await stripe.customers.create({
    email: emailAcheteur ?? undefined,
    name: nomComplet,
    metadata: { boutique: slug },
  })

  let setupIntent
  try {
    setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { type: 'achat_multi', beatmaker_id: String(beatmaker.id) },
      ...(body.payment_method_id ? {
        payment_method: body.payment_method_id,
        confirm: true,
        return_url: `${new URL(request.url).origin}/paiement/${slug}`,
      } : {}),
    })
  } catch (err) {
    console.error('[paiement-multi/preparer] Enregistrement du moyen de paiement refusé:', err instanceof Error ? err.message : err)
    return NextResponse.json({ erreur: 'Ton moyen de paiement a été refusé. Aucun montant n’a été débité.' }, { status: 402 })
  }

  const metadonnees: Record<string, string> = {
    type: 'achat_multi',
    beatmaker_id: String(beatmaker.id),
    slug,
    source_marketing: source_marketing ?? 'direct',
    newsletter_opt_in: newsletter_opt_in === true ? 'true' : 'false',
    ...(type_client === 'professionnel' && raison_sociale?.trim() ? { acheteur_raison_sociale: raison_sociale.trim().slice(0, 200) } : {}),
    ...(type_client === 'professionnel' && numero_tva?.trim() ? { acheteur_numero_tva: numero_tva.trim().toUpperCase().slice(0, 32) } : {}),
    ...(codePromoValide ? { code_promo: codePromoValide } : {}),
  }

  const { data: tentative, error: tentativeError } = await admin.from('tentatives_paiement').insert({
    type: 'achat_multi',
    beatmaker_id: beatmaker.id,
    client_id: await resoudreClientId(admin, user),
    email: emailAcheteur,
    prix: totalCents / 100,
    code_promo: codePromoValide,
    source_marketing: source_marketing ?? 'direct',
    stripe_setup_intent_id: setupIntent.id,
    statut: 'creee',
    metadonnees,
    prenom: prenom ?? null,
    nom: nom ?? null,
    telephone: telephone ?? null,
    adresse: adresse ?? null,
    code_postal: code_postal ?? null,
    ville: ville ?? null,
    pays: pays ?? null,
  }).select('id').single()

  if (tentativeError || !tentative) {
    console.error('[paiement-multi/preparer] Erreur insert tentative:', JSON.stringify(tentativeError))
    return NextResponse.json({ erreur: 'Erreur serveur, réessaie' }, { status: 500 })
  }

  const [{ error: lignesError }, { error: partsError }] = await Promise.all([
    admin.from('tentatives_paiement_lignes').insert(lignes.map(l => ({
      tentative_id: tentative.id,
      beat_id: l.beat_id,
      licence_id: l.licence_id,
      prix: l.prixTotalCents / 100,
      reduction_montant: l.reductionCodeCents / 100,
      code_promo_applique: l.codePromoApplique,
      reduction_lot_id: l.reductionLotId,
    }))),
    admin.from('tentatives_paiement_parts').insert(tranches.map(t => ({
      tentative_id: tentative.id,
      vendeur_id: t.vendeur_id,
      est_proprietaire: t.est_proprietaire,
      stripe_account_id: compteParVendeur.get(t.vendeur_id),
      montant_cents: t.montant_cents,
      detail_lignes: t.detail_lignes,
    }))),
  ])
  if (lignesError || partsError) {
    console.error('[paiement-multi/preparer] Erreur insert lignes/parts:', JSON.stringify(lignesError ?? partsError))
    await admin.from('tentatives_paiement').update({ statut: 'echouee' }).eq('id', tentative.id)
    return NextResponse.json({ erreur: 'Erreur serveur, réessaie' }, { status: 500 })
  }

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    statut: setupIntent.status,
    totalCents,
  })
}
