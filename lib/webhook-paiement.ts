import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { genererContratPdfPourVente } from '@/lib/contrat'
import { genererFacturePdfPourCommande, genererFacturePdfPourTranche } from '@/lib/facture'
import { genererNumeroFacture, modeleFactureEffectif } from '@/lib/facturation'
import { uploadPdfContrat, uploadPdfFacture, uploadPdfFactureTranche } from '@/lib/livraison'
import { confirmationCommande, envoyerNouvelleVente } from '@/lib/emails'
import { decomposerTva } from '@/lib/collaboration-parts'
import type { DetailLigneTranche } from '@/lib/paiement-multi-repartition'
import { enregistrerConversionParClic } from '@/lib/mailing'
import { automatisationActive, type TypeAutomatisation } from '@/lib/automatisations'
import { MANDAT_FULFILLMENT_VERSION_ACTUELLE } from '@/lib/fulfillment'
import { calculerStatutLivraison } from '@/lib/livraison-statut'
import { completerCommande, remplirFraisTranches } from '@/lib/completion-commande'
import { fuseauSur } from '@/lib/fuseau-horaire'
import type Stripe from 'stripe'

// Traitement des paiements de vente (panier classique + achat express) —
// partagé entre le webhook plateforme (app/api/stripe/webhook/route.ts,
// events destination charge/platform-level) et le webhook Connect
// (app/api/stripe/webhook-connect/route.ts, events Direct Charge d'un
// compte connecté) depuis la Phase 2 (bascule Direct Charge). Même pipeline
// de création de commande quelle que soit la source de l'event — seul
// `stripeAccountId` diffère (null en destination charge, l'id du compte
// connecté en Direct Charge), utilisé pour retrouver la bonne autorité de
// remboursement plus tard (Phase 3).

// Formate une adresse Stripe (Checkout Session ou billing_details d'un
// PaymentMethod) en une seule ligne lisible, pour affichage direct dans un
// contrat de licence (variable [ADRESSE DU LICENCIÉ]).
function formaterAdresse(address: Stripe.Address | null | undefined): string | null {
  if (!address) return null
  const parts = [
    [address.line1, address.line2].filter(Boolean).join(' '),
    [address.postal_code, address.city].filter(Boolean).join(' '),
    address.country,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export async function resoudreClientParEmail(supabase: ReturnType<typeof createAdminClient>, email: string | null) {
  if (!email) return null
  const emailNorm = email.toLowerCase().trim()
  const { data: client } = await supabase.from('clients').select('id').eq('email', emailNorm).maybeSingle()
  return client?.id ?? null
}

// Résolution client par email — crée un compte invité si inconnu (contrairement
// à resoudreClientParEmail qui ne fait que chercher, sans créer)
// Email normalisé en minuscule (comparaison ET stockage) — sinon la même
// personne peut se retrouver dupliquée en 2 fiches clients selon la casse
// tapée au checkout (bug découvert en testant Phase 5.9, 2026-07-16).
// address n'est renseignée que par les flux d'achat de licence (voir
// commentaire sur clients.adresse dans schema.sql : "demandée au premier
// achat"). Sur un client déjà existant, on ne remplit que si le champ est
// encore vide — jamais d'écrasement d'une adresse déjà connue.
export async function resoudreOuCreerClient(
  supabase: ReturnType<typeof createAdminClient>,
  email: string | null,
  nom: string | null,
  address?: Stripe.Address | null,
  telephone?: string | null,
  optionsClient?: {
    newsletterOptIn?: boolean
  },
): Promise<string | null> {
  if (!email) return null
  const emailNorm = email.toLowerCase().trim()

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id, adresse, prenom, telephone')
    .eq('email', emailNorm)
    .maybeSingle()

  if (existingClient) {
    const backfill: Record<string, string | boolean | null> = {}
    // Cette checkbox est un opt-in uniquement : une absence de coche ne doit
    // jamais désinscrire un client qui avait déjà donné son consentement.
    if (optionsClient?.newsletterOptIn === true) {
      backfill.newsletter_consent = true
    }
    if (address && !existingClient.adresse) {
      backfill.adresse = [address.line1, address.line2].filter(Boolean).join(' ') || null
      backfill.ville = address.city ?? null
      backfill.code_postal = address.postal_code ?? null
      backfill.pays = address.country ?? null
    }
    // Prénom vide (client créé avant qu'un paiement express ne remonte de
    // nom — cf correctif du même chantier) : on le complète dès qu'un vrai
    // nom est disponible, jamais d'écrasement d'un prénom déjà renseigné.
    if (nom && !existingClient.prenom) {
      const parts = nom.trim().split(' ')
      backfill.prenom = parts[0] || null
      backfill.nom = parts.slice(1).join(' ') || parts[0] || null
    }
    if (telephone && !existingClient.telephone) {
      backfill.telephone = telephone
    }
    if (Object.keys(backfill).length > 0) {
      const { error } = await supabase.from('clients').update(backfill).eq('id', existingClient.id)
      if (error) console.error('[webhook-paiement] Erreur backfill client:', JSON.stringify(error))
    }
    return existingClient.id
  }

  const parts = (nom ?? '').trim().split(' ')
  const prenom = parts[0] || null
  const nomFamille = parts.slice(1).join(' ') || parts[0] || emailNorm.split('@')[0]
  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert({
      id: crypto.randomUUID(),
      email: emailNorm,
      nom: nomFamille,
      prenom,
      telephone: telephone ?? null,
      adresse: address ? ([address.line1, address.line2].filter(Boolean).join(' ') || null) : null,
      ville: address?.city ?? null,
      code_postal: address?.postal_code ?? null,
      pays: address?.country ?? null,
      newsletter_consent: optionsClient?.newsletterOptIn === true,
    })
    .select('id')
    .single()
  if (clientError) console.error('[webhook-paiement] Erreur insert client invité:', JSON.stringify(clientError))
  return newClient?.id ?? null
}

// Paiement express (Apple Pay/Google Pay/PayPal) depuis la popup licence —
// même pipeline de création de commande que le panier classique, juste
// déclenché par un PaymentIntent au lieu d'une Checkout Session (voir
// supabase/express_checkout.sql). Le garde `metadata.type === 'achat_express'`
// est posé par l'appelant (webhook plateforme ou Connect) pour ne jamais
// retraiter les PaymentIntents internes des Checkout Sessions classiques.
// `receipt_email` n'est renseigné que si notre serveur l'a explicitement
// passé à la création du PaymentIntent (client connecté, ou email tapé dans
// le champ panier "si non connecté") — un acheteur anonyme au paiement
// express (Apple Pay/Google Pay, emailRequired:true côté Elements) n'a
// jamais ce champ rempli, alors que le wallet a bien collecté son email de
// contact. Repli sur billing_details.email de la méthode de paiement
// confirmée avant d'abandonner. Découvert en testant Direct Charge le
// 2026-08-27 mais préexistant à Direct Charge (même trou côté destination
// charge, jamais remarqué car les tests précédents utilisaient un compte
// déjà connu).
async function resoudreBillingAchatExpress(paymentIntent: Stripe.PaymentIntent, stripeAccountId: string | null): Promise<{ email: string | null; nom: string | null; adresse: string | null; adresseRaw: Stripe.Address | null; telephone: string | null }> {
  const paymentMethodId = typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method?.id
  const emailDirect = paymentIntent.receipt_email?.toLowerCase().trim() ?? null
  if (!paymentMethodId) return { email: emailDirect, nom: null, adresse: null, adresseRaw: null, telephone: null }

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(
      paymentMethodId,
      undefined,
      stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    )
    return {
      email: emailDirect ?? paymentMethod.billing_details?.email?.toLowerCase().trim() ?? null,
      nom: paymentMethod.billing_details?.name ?? null,
      adresse: formaterAdresse(paymentMethod.billing_details?.address),
      adresseRaw: paymentMethod.billing_details?.address ?? null,
      telephone: paymentMethod.billing_details?.phone ?? null,
    }
  } catch (err) {
    console.error('[webhook-paiement] Erreur récupération payment_method pour billing_details:', err instanceof Error ? err.message : err)
    return { email: emailDirect, nom: null, adresse: null, adresseRaw: null, telephone: null }
  }
}

export async function traiterPaiementExpress(paymentIntent: Stripe.PaymentIntent, stripeAccountId: string | null) {
  const meta = paymentIntent.metadata
  if (!meta?.beatmaker_id) return

  const { email: acheteurEmail, nom: acheteurNom, adresse: acheteurAdresse, adresseRaw: acheteurAdresseRaw, telephone: acheteurTelephone } = await resoudreBillingAchatExpress(paymentIntent, stripeAccountId)

  await finaliserCommandePayee({
    meta,
    tentativeColonne: 'stripe_payment_intent_id',
    tentativeValeur: paymentIntent.id,
    acheteurEmail,
    acheteurNom,
    acheteurAdresse,
    acheteurAdresseRaw,
    acheteurTelephone,
    totalCents: paymentIntent.amount,
    stripePaymentId: paymentIntent.id,
    stripeSessionId: null,
    stripeAccountId,
  })
}

// Part d'un vendeur dans une commande à plusieurs vendeurs (Phase 13) —
// montant à 0 € possible (beat collab offert) : pas d'encaissement ni de
// facture, mais le vendeur voit la vente.
export type TrancheACreer = {
  vendeur_id: string
  est_proprietaire: boolean
  montant_cents: number
  detail_lignes: DetailLigneTranche[]
  stripe_account_id: string | null
  stripe_payment_intent_id: string | null
}

type ContextePaiement = {
  meta: Stripe.Metadata
  tentativeColonne: 'stripe_session_id' | 'stripe_payment_intent_id' | 'stripe_setup_intent_id' | 'id'
  tentativeValeur: string
  acheteurEmail: string | null
  acheteurNom: string | null
  acheteurAdresse: string | null
  // Objet Stripe brut (avant formatage) — sert à préremplir les champs
  // séparés clients.adresse/ville/code_postal/pays, jamais la chaîne déjà
  // formatée pour l'affichage/le contrat.
  acheteurAdresseRaw?: Stripe.Address | null
  acheteurTelephone?: string | null
  totalCents: number
  stripePaymentId: string | null
  stripeSessionId: string | null
  // null = destination charge (PaymentIntent sur le compte plateforme,
  // remboursement futur sans option stripeAccount) ; sinon l'id du compte
  // connecté sur lequel vit réellement le PaymentIntent (Direct Charge).
  stripeAccountId: string | null
  // Paiement réparti entre vendeurs (Phase 13) : un encaissement par vendeur,
  // suivi dans commande_tranches — une facture par vendeur (tranche), jamais
  // une facture unique au nom de A.
  paiementMulti?: boolean
  tranches?: TrancheACreer[]
  // Commande gratuite (Phase 13, lot 3) : beat offert par code promo, aucun
  // paiement, aucune facture.
  methodePaiement?: 'stripe' | 'gratuit'
  // La place sur le code promo a déjà été prise avant la commande (commande
  // gratuite) : ne pas la compter une deuxième fois.
  placeCodePromoPrise?: boolean
}

type TrancheCreee = { id: string; facture_numero: string | null; stripe_account_id: string | null; stripe_payment_intent_id: string | null; montant_ttc_cents: number }

// Tranches d'une commande à plusieurs vendeurs — numéro de facture pris dans
// la suite de CHAQUE vendeur (jamais celle de A pour B), modèle/mentions/TVA
// figés sur la tranche au moment de la vente. Pas de facture pour une part à
// 0 € (beat offert : aucune opération à facturer) ni sans mandat accepté.
async function creerTranches(
  supabase: ReturnType<typeof createAdminClient>,
  commandeId: string,
  tranches: TrancheACreer[],
  dateVente: Date,
): Promise<TrancheCreee[]> {
  const { data: vendeurs } = await supabase
    .from('beatmakers')
    .select('id, nom_artiste, slug, tva_active, tva_taux, tva_numero, mandat_facturation_version, facturation_format, fuseau_horaire, pays, facture_modele, facture_mentions')
    .in('id', tranches.map(t => t.vendeur_id))
  const vendeurMap = new Map((vendeurs ?? []).map(v => [v.id as string, v]))

  const lignes = []
  for (const t of tranches) {
    const v = vendeurMap.get(t.vendeur_id)
    const taux = v?.tva_active && v?.tva_taux ? Number(v.tva_taux) : 0
    const { htCents, tvaCents } = decomposerTva(t.montant_cents, taux)
    const pcts = new Set(t.detail_lignes.map(d => d.pourcentage))

    let facture: Record<string, unknown> = {}
    if (v?.mandat_facturation_version && t.montant_cents > 0) {
      try {
        const numero = await genererNumeroFacture(supabase, {
          beatmakerId: t.vendeur_id,
          slug: v.slug,
          format: v.facturation_format ?? null,
          dateVente,
          fuseauHoraire: fuseauSur(v.fuseau_horaire),
        })
        facture = {
          facture_numero: numero,
          mandat_facturation_version: v.mandat_facturation_version,
          facture_modele: modeleFactureEffectif(v.facture_modele, v.pays),
          facture_mentions: v.facture_mentions ?? null,
          tva_numero: taux > 0 ? (v.tva_numero ?? null) : null,
        }
      } catch (err) {
        console.error('[webhook-paiement] Erreur attribution numéro de facture (tranche) pour', t.vendeur_id, ':', err)
      }
    }

    lignes.push({
      commande_id: commandeId,
      vendeur_id: t.vendeur_id,
      vendeur_nom: v?.nom_artiste ?? 'Vendeur',
      est_proprietaire: t.est_proprietaire,
      quote_part_pct: pcts.size === 1 ? [...pcts][0] : null,
      montant_ttc_cents: t.montant_cents,
      tva_taux: taux,
      montant_tva_cents: tvaCents,
      montant_ht_cents: htCents,
      stripe_account_id: t.stripe_account_id,
      stripe_payment_intent_id: t.stripe_payment_intent_id,
      statut: 'payee',
      detail_lignes: t.detail_lignes,
      ...(t.stripe_payment_intent_id ? {} : { frais_stripe_cents: 0, net_cents: t.montant_cents }),
      ...facture,
    })
  }

  const { data, error } = await supabase
    .from('commande_tranches')
    .insert(lignes)
    .select('id, facture_numero, stripe_account_id, stripe_payment_intent_id, montant_ttc_cents')
  if (error) console.error('[webhook-paiement] Erreur insert commande_tranches pour', commandeId, JSON.stringify(error))
  return (data ?? []) as TrancheCreee[]
}

// Cœur commun aux deux chemins de paiement (panier classique via Checkout
// Session, et achat express via PaymentIntent) : lecture du panier déjà
// calculé côté serveur, création commande + commande_lignes, splits Connect,
// contrats PDF, email de confirmation, automatisations CRM. Rien ici ne doit
// dépendre de la forme exacte de l'objet Stripe d'origine — voir
// traiterPaiement()/traiterPaiementExpress() pour l'adaptation en amont.
export async function finaliserCommandePayee(ctx: ContextePaiement): Promise<string | null> {
  const { meta } = ctx
  const prixPayeTotal = ctx.totalCents / 100
  const stripePaymentId = ctx.stripePaymentId
  const promoCode = meta.code_promo ?? null

  const supabase = createAdminClient()

  // Le détail du panier (quels beats/licences) n'est jamais dans la metadata
  // Stripe (limite de taille pour un panier à N articles, et absent d'un
  // PaymentIntent express) — source de vérité : tentatives_paiement_lignes,
  // écrites en DB au moment du checkout/de la création du PaymentIntent.
  const { data: tentative } = await supabase
    .from('tentatives_paiement')
    .select('id, prenom, nom, telephone, adresse, code_postal, ville, pays')
    .eq(ctx.tentativeColonne, ctx.tentativeValeur)
    .maybeSingle()

  if (!tentative) {
    console.error('[webhook-paiement] Aucune tentative_paiement pour', ctx.tentativeColonne, ':', ctx.tentativeValeur)
    return null
  }

  const { data: tentativeLignes } = await supabase
    .from('tentatives_paiement_lignes')
    .select('id, beat_id, licence_id, prix, reduction_montant, reduction_lot_id')
    .eq('tentative_id', tentative.id)

  if (!tentativeLignes || tentativeLignes.length === 0) {
    console.error('[webhook-paiement] Aucune ligne de panier pour la tentative:', tentative.id)
    return null
  }

  // Page de paiement custom (Phase 9) : le formulaire capture prénom/nom/
  // adresse/type client directement, plus fiable et complet que les
  // billing_details renvoyés par Stripe (utilisés en repli pour un paiement
  // express sans ce formulaire, ex. popup licence). Priorité à la tentative
  // dès qu'elle porte une valeur.
  const nomComplet = tentative.prenom || tentative.nom
    ? [tentative.prenom, tentative.nom].filter(Boolean).join(' ')
    : null
  // Normalisé une seule fois ici, réutilisé pour tout (résolution/création
  // client, commandes.acheteur_email, envoi d'email) — voir lib/email.ts.
  const acheteurEmail = ctx.acheteurEmail ? ctx.acheteurEmail.toLowerCase().trim() : null
  const acheteurNom = nomComplet ?? ctx.acheteurNom
  const acheteurTelephone = tentative.telephone ?? ctx.acheteurTelephone ?? null
  const acheteurAdresseRaw: Stripe.Address | null = tentative.adresse
    ? {
        line1: tentative.adresse, line2: null,
        city: tentative.ville ?? null, postal_code: tentative.code_postal ?? null,
        country: tentative.pays ?? null, state: null,
      }
    : (ctx.acheteurAdresseRaw ?? null)
  const acheteurAdresse = tentative.adresse ? formaterAdresse(acheteurAdresseRaw) : ctx.acheteurAdresse
  const newsletterOptIn = meta.newsletter_opt_in === 'true'
  const acheteurRaisonSociale = meta.acheteur_raison_sociale?.trim() || null
  const acheteurNumeroTva = meta.acheteur_numero_tva?.trim() || null

  const clientId = await resoudreOuCreerClient(supabase, acheteurEmail, acheteurNom, acheteurAdresseRaw, acheteurTelephone, {
    newsletterOptIn,
  })

  const beatIds = [...new Set(tentativeLignes.map(l => l.beat_id as string))]
  const licenceIds = [...new Set(tentativeLignes.map(l => l.licence_id as string))]

  type SplitRow = {
    id: string
    beat_id: string
    pourcentage: number
    beatmaker_id: string | null
    email_invite: string | null
    beatmakers: { nom_artiste: string; email: string; stripe_account_id: string | null } | null
  }

  const [{ data: beatsData }, { data: licencesData }, { data: splitsData }, { data: beatmaker }, { data: cgvData }] = await Promise.all([
    supabase.from('beats').select('id, titre, bpm, cle').in('id', beatIds),
    supabase.from('licences').select('id, nom, modele, inclut_mp3, inclut_wav, inclut_stems, est_exclusive, streams_limite, ventes_physiques_limite, vues_video_limite, clips_video_limite, radio_tv_limite, lives_performances_autorise').in('id', licenceIds),
    supabase.from('beat_splits').select('id, beat_id, pourcentage, beatmaker_id, email_invite, beatmakers(nom_artiste, email, stripe_account_id)').in('beat_id', beatIds).eq('statut', 'active'),
    supabase.from('beatmakers').select('nom_artiste, email, slug, stripe_account_id, tva_active, tva_taux, tva_numero, mandat_facturation_version, facturation_format, fuseau_horaire, pays, facture_modele, facture_mentions').eq('id', meta.beatmaker_id).single(),
    supabase.from('boutique_pages_legales').select('version').eq('beatmaker_id', meta.beatmaker_id).eq('type_page', 'cgv').maybeSingle(),
  ])

  const beatMap = new Map((beatsData ?? []).map(b => [b.id, b]))
  const licenceMap = new Map((licencesData ?? []).map(l => [l.id, l]))

  const splitsByBeat = new Map<string, SplitRow[]>()
  for (const s of (splitsData ?? []) as unknown as SplitRow[]) {
    const arr = splitsByBeat.get(s.beat_id) ?? []
    arr.push(s)
    splitsByBeat.set(s.beat_id, arr)
  }

  const reductionTotal = tentativeLignes.reduce((sum, l) => sum + Number(l.reduction_montant ?? 0), 0)

  // 1. Header de commande — 1 panier = 1 vraie ligne `commandes`, quel que
  // soit le nombre d'articles
  const { data: commande, error } = await supabase.from('commandes').insert({
    client_id: clientId,
    beatmaker_id: meta.beatmaker_id,
    acheteur_email: acheteurEmail,
    acheteur_nom: acheteurNom,
    acheteur_adresse: acheteurAdresse,
    acheteur_telephone: acheteurTelephone,
    acheteur_raison_sociale: acheteurRaisonSociale,
    acheteur_numero_tva: acheteurNumeroTva,
    prix_paye: prixPayeTotal,
    methode_paiement: ctx.methodePaiement ?? 'stripe',
    stripe_payment_id: stripePaymentId,
    stripe_session_id: ctx.stripeSessionId,
    // Snapshot minimal (tâche 2.8) — null en destination charge (le
    // remboursement futur n'aura jamais besoin d'option stripeAccount pour
    // cette commande), sinon le compte connecté réel utilisé au moment de
    // la vente, jamais le stripe_account_id *actuel* du beatmaker.
    stripe_account_id: ctx.stripeAccountId,
    statut: 'payee',
    // Snapshot transactionnel (Phase 4) — TVA/CGV/mandat de fulfillment
    // réellement en vigueur pour ce beatmaker à l'instant de la vente,
    // jamais recalculés depuis leur état *actuel* plus tard.
    tva_taux: beatmaker?.tva_active && beatmaker?.tva_taux ? beatmaker.tva_taux : 0,
    tva_numero: beatmaker?.tva_active && beatmaker?.tva_taux ? (beatmaker.tva_numero ?? null) : null,
    cgv_version: cgvData?.version ?? null,
    mandat_fulfillment_version: MANDAT_FULFILLMENT_VERSION_ACTUELLE,
    code_promo: promoCode,
    reduction_montant: reductionTotal,
    // Statut de livraison réel (Phase 5) — calculé après coup une fois les
    // contrats/factures tentés, jamais figé ici. fichiers_livres reste
    // écrit pour compatibilité tant que la colonne existe (voir migration
    // phase5_statut_livraison.sql), sera retiré dans un nettoyage séparé.
    fichiers_livres: false,
    statut_livraison: 'en_cours',
    plateforme_source: 'my_producer',
    source_marketing: meta.source_marketing ?? 'direct',
    type_commande: 'LICENCE',
    paiement_multi_vendeurs: ctx.paiementMulti === true,
  }).select('id').single()

  if (error || !commande) {
    console.error('[webhook-paiement] Erreur insert commande:', JSON.stringify(error))
    return null
  }

  console.log('[webhook-paiement] Commande créée:', commande.id, '—', tentativeLignes.length, 'article(s)')

  // Facturation (Phase 8, chantier 9 bis) — numéro attribué une seule fois
  // ici, jamais recalculé ensuite (voir lib/facturation.ts pour l'atomicité
  // et le raisonnement complet sur le format). Aucune facture générée tant
  // que le beatmaker n'a pas explicitement accepté le mandat de facturation
  // (pas de préselection silencieuse, même principe que les pages légales).
  // Commande entièrement gratuite (beat offert) : aucune facture — pas
  // d'opération à titre onéreux (décision Phase 13 lot 3, Q1).
  let numeroFactureAttribue = false
  if (beatmaker?.mandat_facturation_version && !ctx.paiementMulti && ctx.totalCents > 0) {
    try {
      const numeroFacture = await genererNumeroFacture(supabase, {
        beatmakerId: meta.beatmaker_id,
        slug: beatmaker.slug,
        format: beatmaker.facturation_format ?? null,
        dateVente: new Date(),
        fuseauHoraire: fuseauSur(beatmaker.fuseau_horaire),
      })
      await supabase.from('commandes').update({
        numero_facture: numeroFacture,
        mandat_facturation_version: beatmaker.mandat_facturation_version,
        facture_modele: modeleFactureEffectif(beatmaker.facture_modele, beatmaker.pays),
        facture_mentions: beatmaker.facture_mentions ?? null,
      }).eq('id', commande.id)
      numeroFactureAttribue = true
    } catch (err) {
      console.error('[webhook-paiement] Erreur attribution numéro de facture:', err)
    }
  }

  const tranchesCreees = ctx.tranches?.length
    ? await creerTranches(supabase, commande.id, ctx.tranches, new Date())
    : []

  // 2. Une commande_ligne par article : splits, contrat PDF
  let contratsOk = 0

  for (const tLigne of tentativeLignes) {
    const beat = beatMap.get(tLigne.beat_id)
    const licence = licenceMap.get(tLigne.licence_id)
    const splitsBeat = splitsByBeat.get(tLigne.beat_id) ?? []

    let splitsSnapshot: { nom_artiste: string; pourcentage: number; email?: string }[]
    if (splitsBeat.length === 0) {
      splitsSnapshot = [{ nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker', pourcentage: 100, email: beatmaker?.email }]
    } else {
      splitsSnapshot = splitsBeat.map(s => ({
        nom_artiste: s.beatmakers?.nom_artiste ?? s.email_invite ?? 'Collab',
        pourcentage: s.pourcentage,
        email: s.beatmakers?.email ?? s.email_invite ?? undefined,
      }))
    }

    const { data: ligne, error: ligneError } = await supabase.from('commande_lignes').insert({
      commande_id: commande.id,
      beat_id: tLigne.beat_id,
      licence_id: tLigne.licence_id,
      prix_paye: tLigne.prix,
      reduction_montant: tLigne.reduction_montant ?? 0,
      reduction_lot_id: tLigne.reduction_lot_id ?? null,
      splits_snapshot: splitsSnapshot,
      // Snapshot transactionnel (Phase 4) — ce que la licence incluait au
      // moment de l'achat, indépendant d'une modification future de la
      // licence elle-même (les fichiers réels restent volontairement live,
      // voir telechargement/[commandeId]/page.tsx).
      licence_nom: licence?.nom ?? null,
      licence_modele: licence?.modele ?? null,
      licence_inclut_mp3: licence?.inclut_mp3 ?? null,
      licence_inclut_wav: licence?.inclut_wav ?? null,
      licence_inclut_stems: licence?.inclut_stems ?? null,
      licence_streams_limite: licence?.streams_limite ?? null,
      licence_ventes_physiques_limite: licence?.ventes_physiques_limite ?? null,
      licence_vues_video_limite: licence?.vues_video_limite ?? null,
      licence_clips_video_limite: licence?.clips_video_limite ?? null,
      licence_radio_tv_limite: licence?.radio_tv_limite ?? null,
      licence_lives_performances_autorise: licence?.lives_performances_autorise ?? null,
    }).select('id').single()

    if (ligneError || !ligne) {
      console.error('[webhook-paiement] Erreur insert commande_ligne:', JSON.stringify(ligneError))
      continue
    }

    await supabase.from('tentatives_paiement_lignes').update({ commande_ligne_id: ligne.id }).eq('id', tLigne.id)

    // Licence Exclusive (Phase 6) : le contrat interdit explicitement au
    // beatmaker de revendre l'Œuvre après cette vente (article 4.1) — le
    // beat doit donc être retiré de la vente pour que la plateforme
    // respecte elle-même ce que le contrat promet. Colonne beats.statut
    // 'vendu' prévue depuis le schéma d'origine, jamais branchée jusqu'ici.
    // L'historique/les analytics du beat restent intacts (rien ne filtre
    // sur ce statut côté analytics), seule la boutique publique le masque.
    if (licence?.est_exclusive) {
      const { error: retraitError } = await supabase.from('beats').update({ statut: 'vendu' }).eq('id', tLigne.beat_id)
      if (retraitError) console.error('[webhook-paiement] Erreur retrait beat après vente Exclusive:', JSON.stringify(retraitError))
    }

    // Garde-fou Follow-up free download (5.7) : si ce client avait
    // téléchargé ce beat gratuitement, marquer achete=true — plus rien
    // n'écrivait cette colonne avant 5.7, le garde-fou était mort-né. Vérifié
    // à l'envoi de l'automatisation, pas ici (lib/automatisations.ts).
    if (clientId) {
      const { error: acheteError } = await supabase
        .from('free_downloads')
        .update({ achete: true })
        .eq('client_id', clientId)
        .eq('beat_id', tLigne.beat_id)
        .eq('beatmaker_id', meta.beatmaker_id)
      if (acheteError) console.error('[webhook-paiement] Erreur maj free_downloads.achete:', JSON.stringify(acheteError))
    }

    // Contrat PDF par article
    try {
      if (beat && licence) {
        const pdfBytes = await genererContratPdfPourVente(supabase, {
          beatId: tLigne.beat_id,
          licenceId: tLigne.licence_id,
          beatmakerId: meta.beatmaker_id,
          acheteurNom,
          acheteurEmail,
          acheteurAdresse,
          prixPaye: Number(tLigne.prix),
          splits: splitsSnapshot,
          dateVente: new Date(),
          limitesSnapshot: {
            streams_limite: licence.streams_limite,
            ventes_physiques_limite: licence.ventes_physiques_limite,
            vues_video_limite: licence.vues_video_limite,
            clips_video_limite: licence.clips_video_limite,
            radio_tv_limite: licence.radio_tv_limite,
            lives_performances_autorise: licence.lives_performances_autorise,
          },
        })
        const pdfUrl = await uploadPdfContrat(ligne.id, pdfBytes)
        await supabase.from('commande_lignes').update({ contrat_pdf_url: pdfUrl }).eq('id', ligne.id)
        contratsOk++
        console.log('[webhook-paiement] Contrat PDF généré pour la ligne', ligne.id, ':', pdfUrl)
      }
    } catch (err) {
      console.error('[webhook-paiement] Erreur génération PDF pour la ligne', ligne.id, ':', err)
    }
  }

  // Facture PDF (Phase 8) — générée une fois toutes les commande_lignes en
  // base (genererFacturePdfPourCommande les relit depuis la base). Jamais
  // bloquant pour le reste du webhook si ça échoue.
  if (numeroFactureAttribue) {
    try {
      const pdfBytes = await genererFacturePdfPourCommande(supabase, commande.id)
      const pdfUrl = await uploadPdfFacture(commande.id, pdfBytes)
      await supabase.from('commandes').update({ facture_pdf_url: pdfUrl }).eq('id', commande.id)
      console.log('[webhook-paiement] Facture PDF générée pour la commande', commande.id, ':', pdfUrl)
    } catch (err) {
      console.error('[webhook-paiement] Erreur génération facture PDF:', err)
    }
  }

  for (const t of tranchesCreees.filter(t => t.facture_numero)) {
    try {
      const pdfBytes = await genererFacturePdfPourTranche(supabase, t.id)
      const pdfUrl = await uploadPdfFactureTranche(commande.id, t.id, pdfBytes)
      await supabase.from('commande_tranches').update({ facture_pdf_url: pdfUrl }).eq('id', t.id)
    } catch (err) {
      console.error('[webhook-paiement] Erreur génération facture PDF de la tranche', t.id, ':', err)
    }
  }
  await remplirFraisTranches(supabase, tranchesCreees)

  // Statut de livraison réel, recalculé depuis ce qui existe vraiment. S'il
  // manque une pièce (contrat, facture, frais) : 2e essai tout de suite, puis
  // la tâche de nuit reprend jusqu'à ce que la commande soit complète
  // (lib/completion-commande.ts) — aucune alerte immédiate au beatmaker.
  const { statut: statutLivraison } = await calculerStatutLivraison(commande.id)
  await supabase.from('commandes').update({
    fichiers_livres: contratsOk === tentativeLignes.length,
    statut_livraison: statutLivraison,
  }).eq('id', commande.id)
  if (statutLivraison === 'probleme') {
    await completerCommande(commande.id).catch(err => console.error('[webhook-paiement] 2e essai de complétion en échec:', err))
  }

  // 3. Marquer la tentative de paiement correspondante comme complète
  const { error: tentativeError } = await supabase
    .from('tentatives_paiement')
    .update({ statut: 'complete', commande_id: commande.id, client_id: clientId, email: acheteurEmail })
    .eq('id', tentative.id)
  if (tentativeError) console.error('[webhook-paiement] Erreur maj tentative_paiement:', JSON.stringify(tentativeError))

  if (acheteurEmail) {
    await confirmationCommande({
      to: acheteurEmail,
      beatmakerId: meta.beatmaker_id,
      commandeId: commande.id,
      clientId,
    }).catch(err => console.error('[webhook-paiement] Erreur envoi email confirmation commande:', err))
  }

  // « Nouvelle vente » (Phase 13, lot 3) — au propriétaire de la boutique et à
  // chaque collaborateur vendeur, payée ou offerte.
  await envoyerNouvelleVente({ commandeId: commande.id })
    .catch(err => console.error('[webhook-paiement] Erreur envoi email nouvelle vente:', err))

  // 4. "Remerciement achat" par palier — évalué une seule fois par session
  // (pas par article), sinon l'automation se déclencherait N fois pour un
  // panier de N beats. Un panier compte comme 1 seule commande pour le
  // palier (décision Jake, 2026-07-09) — count = nombre total de commandes
  // LICENCE de ce client chez ce beatmaker, celle-ci incluse.
  if (clientId) {
    const { count } = await supabase
      .from('commandes')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('beatmaker_id', meta.beatmaker_id)
      .eq('type_commande', 'LICENCE')

    const typeParPalier: Record<number, TypeAutomatisation> = {
      1: 'remerciement_1er_achat',
      2: 'remerciement_2e_achat',
      3: 'remerciement_3e_achat',
    }
    const typePalier = count ? (typeParPalier[count] ?? 'remerciement_4e_achat_plus') : null

    if (typePalier && await automatisationActive(meta.beatmaker_id, typePalier)) {
      const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
        beatmaker_id: meta.beatmaker_id,
        client_id: clientId,
        type: typePalier,
        reference_id: commande.id,
      })
      if (evenementError) console.error('[webhook-paiement] Erreur insert automatisation_evenements (remerciement achat):', JSON.stringify(evenementError))
    }
  }

  // Attribution marketing : exige à la fois un clic récent sur la campagne (cookie posé
  // par /api/marketing/clic) ET que l'achat soit fait avec le même client que le
  // destinataire — pour que la conversion reste cohérente avec la fiche client
  // (sinon la commande et la conversion se retrouvent sur deux clients différents).
  // Purement statistique, ne doit jamais faire échouer le paiement.
  if (meta.campagne_id && meta.campagne_client_id && meta.campagne_client_id === clientId) {
    enregistrerConversionParClic(meta.campagne_id, meta.campagne_client_id).catch(err =>
      console.error('[webhook-paiement] Erreur enregistrement conversion campagne:', err)
    )
  }

  // Incrémenter le compteur d'utilisations du code promo — une fois par commande,
  // même si le code s'est appliqué à plusieurs articles du panier. En une seule
  // opération en base (deux ventes simultanées ne se marchent plus dessus) ;
  // vente déjà payée : toujours comptée, jamais refusée.
  if (promoCode && !ctx.placeCodePromoPrise) {
    const { data: codePromoData } = await supabase
      .from('codes_promo')
      .select('id')
      .eq('beatmaker_id', meta.beatmaker_id)
      .eq('code', promoCode)
      .maybeSingle()
    if (codePromoData) {
      const { error: placeError } = await supabase.rpc('code_promo_prendre_place', { p_code_id: codePromoData.id, p_forcer: true })
      if (placeError) console.error('[webhook-paiement] Erreur compteur code promo:', JSON.stringify(placeError))
    }
  }

  // Créer un lead pour ce beatmaker si le client n'en a pas déjà un
  if (clientId) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, newsletter_inscrit')
      .eq('client_id', clientId)
      .eq('beatmaker_id', meta.beatmaker_id)
      .maybeSingle()

    if (!existingLead) {
      const { error: leadError } = await supabase.from('leads').insert({
        client_id:          clientId,
        beatmaker_id:       meta.beatmaker_id,
        source:             'visite',
        newsletter_inscrit: newsletterOptIn,
      })
      if (leadError) console.error('[webhook-paiement] Erreur insert lead:', JSON.stringify(leadError))
    } else if (newsletterOptIn && !existingLead.newsletter_inscrit) {
      const { error: leadError } = await supabase
        .from('leads')
        .update({ newsletter_inscrit: true })
        .eq('id', existingLead.id)
      if (leadError) console.error('[webhook-paiement] Erreur opt-in newsletter lead:', JSON.stringify(leadError))
    }
  }

  return commande.id
}

// Litiges Stripe : voir lib/litiges.ts (Phase 13, lot 4b).
