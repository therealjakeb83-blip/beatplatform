import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { genererContratPdf } from '@/lib/contrat'
import { uploadPdfContrat } from '@/lib/livraison'
import { envoyerFondsEnAttente, confirmationCommande, alerteProblemeLivraison } from '@/lib/emails'
import { enregistrerConversionParClic } from '@/lib/mailing'
import { automatisationActive, type TypeAutomatisation } from '@/lib/automatisations'
import { MANDAT_FULFILLMENT_VERSION_ACTUELLE } from '@/lib/fulfillment'
import { calculerStatutLivraison } from '@/lib/livraison-statut'
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
export async function resoudreOuCreerClient(
  supabase: ReturnType<typeof createAdminClient>,
  email: string | null,
  nom: string | null,
): Promise<string | null> {
  if (!email) return null
  const emailNorm = email.toLowerCase().trim()

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle()

  if (existingClient) return existingClient.id

  const parts = (nom ?? '').trim().split(' ')
  const prenom = parts[0] || null
  const nomFamille = parts.slice(1).join(' ') || parts[0] || emailNorm.split('@')[0]
  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert({ id: crypto.randomUUID(), email: emailNorm, nom: nomFamille, prenom })
    .select('id')
    .single()
  if (clientError) console.error('[webhook-paiement] Erreur insert client invité:', JSON.stringify(clientError))
  return newClient?.id ?? null
}

export async function traiterPaiement(session: Stripe.Checkout.Session, stripeAccountId: string | null) {
  const meta = session.metadata
  if (!meta?.beatmaker_id) return

  await finaliserCommandePayee({
    meta,
    tentativeColonne: 'stripe_session_id',
    tentativeValeur: session.id,
    acheteurEmail: session.customer_details?.email?.toLowerCase().trim() ?? null,
    acheteurNom: session.customer_details?.name ?? null,
    totalCents: session.amount_total ?? 0,
    stripePaymentId: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null),
    stripeSessionId: session.id,
    stripeAccountId,
  })
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
async function resoudreEmailAchatExpress(paymentIntent: Stripe.PaymentIntent, stripeAccountId: string | null): Promise<string | null> {
  const direct = paymentIntent.receipt_email?.toLowerCase().trim()
  if (direct) return direct

  const paymentMethodId = typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method?.id
  if (!paymentMethodId) return null

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(
      paymentMethodId,
      undefined,
      stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    )
    return paymentMethod.billing_details?.email?.toLowerCase().trim() ?? null
  } catch (err) {
    console.error('[webhook-paiement] Erreur récupération payment_method pour email:', err instanceof Error ? err.message : err)
    return null
  }
}

export async function traiterPaiementExpress(paymentIntent: Stripe.PaymentIntent, stripeAccountId: string | null) {
  const meta = paymentIntent.metadata
  if (!meta?.beatmaker_id) return

  const acheteurEmail = await resoudreEmailAchatExpress(paymentIntent, stripeAccountId)

  await finaliserCommandePayee({
    meta,
    tentativeColonne: 'stripe_payment_intent_id',
    tentativeValeur: paymentIntent.id,
    acheteurEmail,
    acheteurNom: null,
    totalCents: paymentIntent.amount,
    stripePaymentId: paymentIntent.id,
    stripeSessionId: null,
    stripeAccountId,
  })
}

type ContextePaiement = {
  meta: Stripe.Metadata
  tentativeColonne: 'stripe_session_id' | 'stripe_payment_intent_id'
  tentativeValeur: string
  acheteurEmail: string | null
  acheteurNom: string | null
  totalCents: number
  stripePaymentId: string | null
  stripeSessionId: string | null
  // null = destination charge (PaymentIntent sur le compte plateforme,
  // remboursement futur sans option stripeAccount) ; sinon l'id du compte
  // connecté sur lequel vit réellement le PaymentIntent (Direct Charge).
  stripeAccountId: string | null
}

// Cœur commun aux deux chemins de paiement (panier classique via Checkout
// Session, et achat express via PaymentIntent) : lecture du panier déjà
// calculé côté serveur, création commande + commande_lignes, splits Connect,
// contrats PDF, email de confirmation, automatisations CRM. Rien ici ne doit
// dépendre de la forme exacte de l'objet Stripe d'origine — voir
// traiterPaiement()/traiterPaiementExpress() pour l'adaptation en amont.
export async function finaliserCommandePayee(ctx: ContextePaiement) {
  const { meta } = ctx
  const acheteurEmail = ctx.acheteurEmail
  const acheteurNom = ctx.acheteurNom
  const prixPayeTotal = ctx.totalCents / 100
  const stripePaymentId = ctx.stripePaymentId
  const hasSplits = meta.has_splits === 'true'
  const transferGroup = meta.transfer_group ?? null
  const promoCode = meta.code_promo ?? null

  const supabase = createAdminClient()

  // Le détail du panier (quels beats/licences) n'est jamais dans la metadata
  // Stripe (limite de taille pour un panier à N articles, et absent d'un
  // PaymentIntent express) — source de vérité : tentatives_paiement_lignes,
  // écrites en DB au moment du checkout/de la création du PaymentIntent.
  const { data: tentative } = await supabase
    .from('tentatives_paiement')
    .select('id')
    .eq(ctx.tentativeColonne, ctx.tentativeValeur)
    .maybeSingle()

  if (!tentative) {
    console.error('[webhook-paiement] Aucune tentative_paiement pour', ctx.tentativeColonne, ':', ctx.tentativeValeur)
    return
  }

  const { data: tentativeLignes } = await supabase
    .from('tentatives_paiement_lignes')
    .select('id, beat_id, licence_id, prix, reduction_montant, reduction_lot_id')
    .eq('tentative_id', tentative.id)

  if (!tentativeLignes || tentativeLignes.length === 0) {
    console.error('[webhook-paiement] Aucune ligne de panier pour la tentative:', tentative.id)
    return
  }

  const clientId = await resoudreOuCreerClient(supabase, acheteurEmail, acheteurNom)

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
    supabase.from('licences').select('id, nom, modele, inclut_mp3, inclut_wav, inclut_stems').in('id', licenceIds),
    supabase.from('beat_splits').select('id, beat_id, pourcentage, beatmaker_id, email_invite, beatmakers(nom_artiste, email, stripe_account_id)').in('beat_id', beatIds),
    supabase.from('beatmakers').select('nom_artiste, email, stripe_account_id, tva_active, tva_taux').eq('id', meta.beatmaker_id).single(),
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
    prix_paye: prixPayeTotal,
    methode_paiement: 'stripe',
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
    cgv_version: cgvData?.version ?? null,
    mandat_fulfillment_version: MANDAT_FULFILLMENT_VERSION_ACTUELLE,
    code_promo: promoCode,
    reduction_montant: reductionTotal,
    // Statut de livraison réel (Phase 5) — calculé après coup une fois les
    // contrats/transferts tentés, jamais figé ici. fichiers_livres reste
    // écrit pour compatibilité tant que la colonne existe (voir migration
    // phase5_statut_livraison.sql), sera retiré dans un nettoyage séparé.
    fichiers_livres: false,
    statut_livraison: 'en_cours',
    plateforme_source: 'my_producer',
    source_marketing: meta.source_marketing ?? 'direct',
    type_commande: 'LICENCE',
    stripe_transfer_group: hasSplits ? transferGroup : null,
  }).select('id').single()

  if (error || !commande) {
    console.error('[webhook-paiement] Erreur insert commande:', JSON.stringify(error))
    return
  }

  console.log('[webhook-paiement] Commande créée:', commande.id, '—', tentativeLignes.length, 'article(s)')

  // 2. Une commande_ligne par article : splits, transferts, contrat PDF
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
    }).select('id').single()

    if (ligneError || !ligne) {
      console.error('[webhook-paiement] Erreur insert commande_ligne:', JSON.stringify(ligneError))
      continue
    }

    await supabase.from('tentatives_paiement_lignes').update({ commande_ligne_id: ligne.id }).eq('id', tLigne.id)

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

    // Distribuer les fonds pour cet article (le panier entier route en mode
    // "fonds retenus + transferts manuels" dès qu'un seul article a des splits)
    if (hasSplits && transferGroup) {
      const montantLigneCents = Math.round(Number(tLigne.prix) * 100)
      await distribuerSplitsArticle({
        supabase,
        splits: splitsBeat,
        beatmaker,
        commandeId: commande.id,
        beatmakerId: meta.beatmaker_id,
        montantCents: montantLigneCents,
        transferGroup,
        titreBeat: beat?.titre ?? 'Beat',
      })
    }

    // Contrat PDF par article
    try {
      if (beat && licence) {
        const pdfBytes = await genererContratPdf({
          beat: { titre: beat.titre, bpm: beat.bpm, cle: beat.cle },
          beatmaker: { nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker' },
          acheteur: { nom: acheteurNom, email: acheteurEmail },
          licence: { nom: licence.nom },
          splits: splitsSnapshot,
          dateVente: new Date(),
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

  // Statut de livraison réel (Phase 5) — recalculé depuis l'état effectif
  // des contrats/transferts, jamais déduit d'un simple compteur local (un
  // échec de transfert Stripe ne fait pas échouer contratsOk, par exemple).
  const { statut: statutLivraison } = await calculerStatutLivraison(commande.id)
  await supabase.from('commandes').update({
    fichiers_livres: contratsOk === tentativeLignes.length,
    statut_livraison: statutLivraison,
  }).eq('id', commande.id)

  // Alerte au beatmaker (Phase 5) — jamais fire-and-forget dans un webhook
  // (voir lib/emails.ts::alerteProblemeLivraison), envoyée une seule fois ici,
  // pas à chaque reprise (voir app/api/business/commandes/[id]/reprendre-livraison).
  if (statutLivraison === 'probleme' && beatmaker?.email) {
    await alerteProblemeLivraison({
      to: beatmaker.email,
      beatmakerId: meta.beatmaker_id,
      commandeId: commande.id,
    }).catch(err => console.error('[webhook-paiement] Erreur envoi alerte problème livraison:', err))
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
  // même si le code s'est appliqué à plusieurs articles du panier
  if (promoCode) {
    const { data: codePromoData } = await supabase
      .from('codes_promo')
      .select('id, utilisations')
      .eq('beatmaker_id', meta.beatmaker_id)
      .eq('code', promoCode)
      .maybeSingle()
    if (codePromoData) {
      await supabase
        .from('codes_promo')
        .update({ utilisations: codePromoData.utilisations + 1 })
        .eq('id', codePromoData.id)
    }
  }

  // Créer un lead pour ce beatmaker si le client n'en a pas déjà un
  if (clientId) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('client_id', clientId)
      .eq('beatmaker_id', meta.beatmaker_id)
      .maybeSingle()

    if (!existingLead) {
      const { error: leadError } = await supabase.from('leads').insert({
        client_id:          clientId,
        beatmaker_id:       meta.beatmaker_id,
        source:             'visite',
        newsletter_inscrit: false,
      })
      if (leadError) console.error('[webhook-paiement] Erreur insert lead:', JSON.stringify(leadError))
    }
  }
}

async function distribuerSplitsArticle({
  supabase,
  splits,
  beatmaker,
  commandeId,
  beatmakerId,
  montantCents,
  transferGroup,
  titreBeat,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  splits: {
    id: string
    beat_id: string
    pourcentage: number
    beatmaker_id: string | null
    email_invite: string | null
    beatmakers: { nom_artiste: string; email: string; stripe_account_id: string | null } | null
  }[]
  beatmaker: { nom_artiste: string; email: string; stripe_account_id: string | null } | null
  commandeId: string
  beatmakerId: string
  montantCents: number
  transferGroup: string
  titreBeat: string
}) {
  // Aucun split sur cet article : 100% part au propriétaire du beat (le beatmaker
  // de la boutique) — le panier entier route quand même en mode manuel car un
  // AUTRE article du même panier a des splits.
  const totalCents = montantCents
  const splitPayments: Record<string, unknown>[] = []
  let montantProprioCents = totalCents

  for (const split of splits) {
    const montantCents = Math.round(totalCents * split.pourcentage / 100)
    montantProprioCents -= montantCents

    if (split.beatmaker_id && split.beatmakers?.stripe_account_id) {
      // Collab inscrit avec compte Stripe → transfer immédiat
      let stripeTransferId: string | null = null
      try {
        const transfer = await stripe.transfers.create({
          amount: montantCents,
          currency: 'eur',
          destination: split.beatmakers.stripe_account_id,
          transfer_group: transferGroup,
          description: `Split ${split.pourcentage}% — ${titreBeat} — commande ${commandeId}`,
        })
        stripeTransferId = transfer.id
        console.log('[webhook-paiement] Transfer créé:', transfer.id, 'pour', split.beatmakers.nom_artiste)
      } catch (err) {
        console.error('[webhook-paiement] Erreur transfer collab:', err)
      }
      splitPayments.push({
        commande_id: commandeId,
        beat_split_id: split.id,
        beatmaker_id: split.beatmaker_id,
        email_invite: null,
        montant: montantCents,
        stripe_transfer_id: stripeTransferId,
        statut: stripeTransferId ? 'transfere' : 'en_attente',
      })
    } else {
      // Collab non inscrit → fonds en attente + email
      splitPayments.push({
        commande_id: commandeId,
        beat_split_id: split.id,
        beatmaker_id: null,
        email_invite: split.email_invite,
        montant: montantCents,
        stripe_transfer_id: null,
        statut: 'en_attente',
      })
      if (split.email_invite) {
        const montantEuros = (montantCents / 100).toFixed(2)
        await envoyerFondsEnAttente({ to: split.email_invite, titreBeat, montantEuros, beatmakerId })
      }
    }
  }

  // Part du propriétaire du beat
  if (montantProprioCents > 0 && beatmaker?.stripe_account_id) {
    let stripeTransferId: string | null = null
    try {
      const transfer = await stripe.transfers.create({
        amount: montantProprioCents,
        currency: 'eur',
        destination: beatmaker.stripe_account_id,
        transfer_group: transferGroup,
        description: `Part propriétaire — ${titreBeat} — commande ${commandeId}`,
      })
      stripeTransferId = transfer.id
      console.log('[webhook-paiement] Transfer propriétaire créé:', transfer.id)
    } catch (err) {
      console.error('[webhook-paiement] Erreur transfer propriétaire:', err)
    }
    splitPayments.push({
      commande_id: commandeId,
      beat_split_id: null,
      beatmaker_id: beatmakerId,
      email_invite: null,
      montant: montantProprioCents,
      stripe_transfer_id: stripeTransferId,
      statut: stripeTransferId ? 'transfere' : 'en_attente',
    })
  }

  if (splitPayments.length) {
    const { error } = await supabase.from('split_payments').insert(splitPayments)
    if (error) console.error('[webhook-paiement] Erreur insert split_payments:', JSON.stringify(error))
    else console.log('[webhook-paiement] split_payments insérés:', splitPayments.length)
  }
}

// ─── Litiges Stripe (rang 9 ROADMAP, décidé avec Jake le 2026-08-31) ────────
// Affichage passif uniquement, aucune décision prise à la place du
// beatmaker : Stripe gère déjà tout le mécanisme (fonds bloqués dès la
// création du litige, preuves, verdict) directement avec lui sur son propre
// compte connecté (Direct Charge). On se contente de refléter le statut sur
// la commande pour qu'elle ne reste pas affichée "Payée" pendant/après un
// litige — jamais d'appel Stripe ici, uniquement de la lecture d'event.

function idPaymentIntent(dispute: Stripe.Dispute): string | null {
  return typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id ?? null
}

export async function marquerLitige(dispute: Stripe.Dispute, stripeAccountId: string | null) {
  if (!stripeAccountId) return
  const paymentIntentId = idPaymentIntent(dispute)
  if (!paymentIntentId) return

  const admin = createAdminClient()

  // Cas limite constaté en testant (carte Stripe 4000000000000259, qui ouvre
  // un litige quasi instantanément — bien plus vite qu'un vrai litige, qui
  // met des jours) : l'event peut arriver AVANT que la commande n'existe en
  // base, celle-ci n'étant créée qu'une fois checkout.session.completed
  // traité (génération du contrat PDF, email...), plus lent. Petite
  // tolérance plutôt que de perdre silencieusement le signal si la commande
  // n'est pas encore là.
  for (let tentative = 0; tentative < 5; tentative++) {
    const { data: commande } = await admin
      .from('commandes')
      .select('id, statut, beatmaker_id, prix_paye')
      .eq('stripe_payment_id', paymentIntentId)
      .eq('stripe_account_id', stripeAccountId)
      .maybeSingle()

    if (commande) {
      // Ne jamais écraser un autre état (ex. déjà remboursée manuellement entre-temps).
      if (commande.statut === 'payee') {
        await admin.from('commandes').update({ statut: 'litige' }).eq('id', commande.id)
      }
      // Historique daté (rang 9, Analytics → Revenus) — indépendant du
      // statut de la commande ci-dessus, toujours enregistré tant qu'un
      // litige Stripe existe. `ignoreDuplicates` : Stripe peut redélivrer le
      // même event, `stripe_dispute_id` est unique.
      await admin.from('litiges').upsert(
        {
          commande_id: commande.id,
          beatmaker_id: commande.beatmaker_id,
          stripe_dispute_id: dispute.id,
          montant: commande.prix_paye,
          statut: 'en_cours',
          ouvert_le: new Date(dispute.created * 1000).toISOString(),
        },
        { onConflict: 'stripe_dispute_id', ignoreDuplicates: true }
      )
      return
    }

    if (tentative < 4) await new Promise(r => setTimeout(r, 3000))
  }
}

// `dispute.status` au moment de charge.dispute.closed vaut 'won' ou 'lost'
// (les autres valeurs possibles de l'objet — warning_*, needs_response,
// under_review — décrivent des étapes avant clôture, jamais reçues sur cet
// event précis).
export async function resoudreLitige(dispute: Stripe.Dispute, stripeAccountId: string | null) {
  if (!stripeAccountId) return
  if (dispute.status !== 'won' && dispute.status !== 'lost') return
  const paymentIntentId = idPaymentIntent(dispute)
  if (!paymentIntentId) return

  const admin = createAdminClient()
  const { data: commande } = await admin
    .from('commandes')
    .select('id, prix_paye')
    .eq('stripe_payment_id', paymentIntentId)
    .eq('stripe_account_id', stripeAccountId)
    .eq('statut', 'litige')
    .maybeSingle()

  if (!commande) return

  await admin
    .from('litiges')
    .update({ statut: dispute.status === 'won' ? 'gagne' : 'perdu', ferme_le: new Date().toISOString() })
    .eq('stripe_dispute_id', dispute.id)

  if (dispute.status === 'won') {
    await admin.from('commandes').update({ statut: 'payee' }).eq('id', commande.id)
  } else {
    // Litige perdu — décision de Jake (2026-08-31) : réutilise le badge
    // "Remboursée" existant, pas de statut distinct. L'argent a déjà quitté
    // le solde du beatmaker à la création du litige ; Stripe ne fait rien de
    // plus à la clôture — ceci n'est qu'un miroir côté My Producer.
    await admin.from('commandes').update({ statut: 'remboursee', montant_rembourse: commande.prix_paye }).eq('id', commande.id)
  }
}
