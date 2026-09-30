import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreRemiseAbonne, validerCodePromo, calculerLignesPanier, resoudreClientId, type ItemPanier } from '@/lib/pricing'
import { calculerPretAVendre } from '@/lib/pret-a-vendre'
import { estRoleAdmin } from '@/lib/admin'
import { normaliserEmail } from '@/lib/email'
import { panierEstMultiVendeurs, repartirPanier } from '@/lib/paiement-multi-repartition'
import { finaliserCommandePayee } from '@/lib/webhook-paiement'
import { cookieAccesTelechargement, DUREE_COOKIE_ACCES } from '@/lib/telechargement-acces'

export const runtime = 'nodejs'
// Contrats PDF + emails, comme après un paiement.
export const maxDuration = 60

// Commande gratuite (Phase 13, lot 3) : un beat offert est une vraie licence
// avec contrat, obtenue UNIQUEMENT par un code promo qui fait tomber tout le
// panier à 0 € (100 %, ou montant fixe ≥ prix). Aucun passage par Stripe,
// aucune facture (pas d'opération à titre onéreux) ; tout le reste est
// identique à une commande payée (contrat, téléchargement, emails, CRM).
// Jamais le free download, qui ne confère aucun droit.
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
  }
  const { slug, code_promo, source_marketing, prenom, nom, telephone, adresse, code_postal, ville, pays, type_client, raison_sociale, numero_tva, newsletter_opt_in } = body
  const items = body.items ?? []
  if (!slug || !items.length || !code_promo) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  // Mêmes champs de facturation qu'une commande payante (décision de Jake).
  const emailAcheteur = normaliserEmail(user?.email ?? body.email_acheteur ?? '') || null
  if (!emailAcheteur || !/^\S+@\S+\.\S+$/.test(emailAcheteur)) return NextResponse.json({ erreur: 'Email invalide' }, { status: 400 })
  if (![prenom, nom, adresse, code_postal, ville].every(v => v?.trim())) {
    return NextResponse.json({ erreur: 'Informations de facturation incomplètes' }, { status: 400 })
  }
  if (type_client === 'professionnel' && !(raison_sociale?.trim() && numero_tva?.trim())) {
    return NextResponse.json({ erreur: 'Informations professionnelles incomplètes' }, { status: 400 })
  }

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

  const remisePct = await resoudreRemiseAbonne(admin, beatmaker, user, slug)
  const promoResult = await validerCodePromo(admin, beatmaker, code_promo, user, emailAcheteur)
  if (!promoResult.ok) return NextResponse.json({ erreur: promoResult.erreur }, { status: promoResult.status })
  if (!promoResult.value) return NextResponse.json({ erreur: 'Code promo invalide' }, { status: 400 })
  const { promo, codePromoValide } = promoResult.value

  const lignesResult = await calculerLignesPanier(admin, beatmaker, items, { remisePct, promo })
  if (!lignesResult.ok) return NextResponse.json({ erreur: lignesResult.erreur }, { status: lignesResult.status })
  const lignes = lignesResult.value
  const totalCents = lignes.reduce((s, l) => s + l.prixTotalCents, 0)
  if (totalCents !== 0) {
    return NextResponse.json({ erreur: 'Cette commande n’est pas gratuite : recharge la page pour payer le bon montant.' }, { status: 409 })
  }

  const multi = panierEstMultiVendeurs(lignes)
  const tranches = multi ? repartirPanier(lignes, String(beatmaker.id)) : []
  const { data: comptes } = multi
    ? await admin.from('beatmakers').select('id, stripe_account_id').in('id', tranches.map(t => t.vendeur_id))
    : { data: [] }
  const compteParVendeur = new Map((comptes ?? []).map(c => [c.id as string, c.stripe_account_id as string | null]))

  // Place sur le code prise AVANT de créer la commande, en une seule opération :
  // deux validations simultanées ne peuvent pas obtenir la même place.
  const codeId = promo.id as string
  const { data: placePrise, error: placeError } = await admin.rpc('code_promo_prendre_place', { p_code_id: codeId, p_forcer: false })
  if (placeError) {
    console.error('[commande-gratuite] Erreur prise de place code promo:', JSON.stringify(placeError))
    return NextResponse.json({ erreur: 'Erreur serveur, réessaie' }, { status: 500 })
  }
  if (!placePrise) return NextResponse.json({ erreur: "Ce code a atteint sa limite d'utilisation" }, { status: 400 })

  const rendrePlace = async () => {
    const { error } = await admin.rpc('code_promo_rendre_place', { p_code_id: codeId })
    if (error) console.error('[commande-gratuite] Erreur restitution place code promo:', JSON.stringify(error))
  }

  const { data: tentative, error: tentativeError } = await admin.from('tentatives_paiement').insert({
    type: 'commande_gratuite',
    beatmaker_id: beatmaker.id,
    client_id: await resoudreClientId(admin, user),
    email: emailAcheteur,
    prix: 0,
    code_promo: codePromoValide,
    source_marketing: source_marketing ?? 'direct',
    statut: 'en_cours',
    prenom: prenom ?? null,
    nom: nom ?? null,
    telephone: telephone ?? null,
    adresse: adresse ?? null,
    code_postal: code_postal ?? null,
    ville: ville ?? null,
    pays: pays ?? null,
  }).select('id').single()
  if (tentativeError || !tentative) {
    console.error('[commande-gratuite] Erreur insert tentative:', JSON.stringify(tentativeError))
    await rendrePlace()
    return NextResponse.json({ erreur: 'Erreur serveur, réessaie' }, { status: 500 })
  }

  const { error: lignesError } = await admin.from('tentatives_paiement_lignes').insert(lignes.map(l => ({
    tentative_id: tentative.id,
    beat_id: l.beat_id,
    licence_id: l.licence_id,
    prix: 0,
    reduction_montant: l.reductionCodeCents / 100,
    code_promo_applique: l.codePromoApplique,
    reduction_lot_id: l.reductionLotId,
  })))
  if (lignesError) {
    console.error('[commande-gratuite] Erreur insert lignes:', JSON.stringify(lignesError))
    await admin.from('tentatives_paiement').update({ statut: 'echouee' }).eq('id', tentative.id)
    await rendrePlace()
    return NextResponse.json({ erreur: 'Erreur serveur, réessaie' }, { status: 500 })
  }

  const commandeId = await finaliserCommandePayee({
    meta: {
      beatmaker_id: String(beatmaker.id),
      slug,
      source_marketing: source_marketing ?? 'direct',
      newsletter_opt_in: newsletter_opt_in === true ? 'true' : 'false',
      code_promo: codePromoValide,
      ...(type_client === 'professionnel' && raison_sociale?.trim() ? { acheteur_raison_sociale: raison_sociale.trim().slice(0, 200) } : {}),
      ...(type_client === 'professionnel' && numero_tva?.trim() ? { acheteur_numero_tva: numero_tva.trim().toUpperCase().slice(0, 32) } : {}),
    },
    tentativeColonne: 'id',
    tentativeValeur: tentative.id,
    acheteurEmail: emailAcheteur,
    acheteurNom: null,
    acheteurAdresse: null,
    totalCents: 0,
    stripePaymentId: null,
    stripeSessionId: null,
    stripeAccountId: null,
    paiementMulti: multi,
    tranches: multi
      ? tranches.map(t => ({
          vendeur_id: t.vendeur_id,
          est_proprietaire: t.est_proprietaire,
          montant_cents: 0,
          detail_lignes: t.detail_lignes,
          stripe_account_id: compteParVendeur.get(t.vendeur_id) ?? null,
          stripe_payment_intent_id: null,
        }))
      : undefined,
    methodePaiement: 'gratuit',
    placeCodePromoPrise: true,
  })

  if (!commandeId) {
    await admin.from('tentatives_paiement').update({ statut: 'echouee' }).eq('id', tentative.id)
    await rendrePlace()
    return NextResponse.json({ erreur: 'La commande n’a pas pu être créée, réessaie.' }, { status: 500 })
  }

  const cookieStore = await cookies()
  cookieStore.set(cookieAccesTelechargement(commandeId), '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: DUREE_COOKIE_ACCES,
    path: `/telechargement/${commandeId}`,
    sameSite: 'lax',
  })
  return NextResponse.json({ commande_id: commandeId })
}
