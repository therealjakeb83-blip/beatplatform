import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { finaliserCommandePayee } from '@/lib/webhook-paiement'
import { decomposerTva } from '@/lib/collaboration-parts'
import type { DetailLigneTranche } from '@/lib/paiement-multi-repartition'

// Moteur du paiement réparti entre vendeurs (Phase 13, lot 1).
// Condition absolue de Jake : l'argent ne transite JAMAIS par la plateforme.
// La carte est enregistrée sur la plateforme par un SetupIntent (aucun
// argent), puis copiée vers le compte Stripe de chaque vendeur ; chaque part
// est d'abord RÉSERVÉE (capture manuelle), et n'est encaissée que si toutes
// les parts sont réservées — sinon toutes les réservations sont annulées.
// Une copie de carte est à usage unique : elle est refaite à chaque tentative.

type Part = {
  id: string
  vendeur_id: string
  est_proprietaire: boolean
  stripe_account_id: string
  montant_cents: number
  detail_lignes: DetailLigneTranche[]
  stripe_payment_intent_id: string | null
  statut: 'a_reserver' | 'reservee' | 'capturee' | 'annulee' | 'echouee' | 'remboursee'
}

type Tentative = {
  id: string
  statut: string
  beatmaker_id: string
  commande_id: string | null
  stripe_setup_intent_id: string
  metadonnees: Stripe.Metadata | null
  email: string | null
  prix: number
}

/** Validation 3D Secure exigée par la banque pour la part d'un vendeur :
 *  affichée à l'écran avec Stripe.js chargé sur le compte de ce vendeur. */
export type ValidationBanque = {
  client_secret: string
  stripe_account_id: string
  payment_method_id: string
  // Position de cette part parmi toutes les parts (« artiste 1 sur 2 »).
  numero?: number
  total?: number
}

export type ResultatPaiementMulti =
  | { ok: true; commandeId: string }
  | { ok: false; erreur: string; status: number; validation?: undefined }
  | { ok: false; validation: ValidationBanque; status: 200; erreur?: undefined }

const MESSAGE_ECHEC = 'Le paiement n’a pas pu aboutir. Aucun montant n’a été débité.'
const MESSAGE_VALIDATION_ECHOUEE = 'La validation demandée par ta banque n’a pas abouti. Aucun montant n’a été débité.'

function messageErreurCarte(err: unknown): string {
  const e = err as { code?: string; decline_code?: string }
  switch (e?.code) {
    case 'card_declined':
      return e.decline_code === 'insufficient_funds'
        ? 'Fonds insuffisants sur ta carte. Aucun montant n’a été débité.'
        : 'Ta carte a été refusée. Aucun montant n’a été débité.'
    case 'expired_card': return 'Ta carte a expiré. Aucun montant n’a été débité.'
    case 'incorrect_cvc': return 'Le code de sécurité de ta carte est incorrect. Aucun montant n’a été débité.'
    default: return MESSAGE_ECHEC
  }
}

async function lireTentative(admin: ReturnType<typeof createAdminClient>, tentativeId: string) {
  const [{ data: tentative }, { data: parts }] = await Promise.all([
    admin.from('tentatives_paiement')
      .select('id, statut, beatmaker_id, commande_id, stripe_setup_intent_id, metadonnees, email, prix')
      .eq('id', tentativeId).eq('type', 'achat_multi').maybeSingle(),
    admin.from('tentatives_paiement_parts')
      .select('id, vendeur_id, est_proprietaire, stripe_account_id, montant_cents, detail_lignes, stripe_payment_intent_id, statut')
      .eq('tentative_id', tentativeId).order('est_proprietaire', { ascending: false }),
  ])
  return { tentative: tentative as Tentative | null, parts: (parts ?? []) as Part[] }
}

async function majPart(admin: ReturnType<typeof createAdminClient>, partId: string, champs: Partial<Part> & { erreur?: string | null }) {
  const { error } = await admin.from('tentatives_paiement_parts')
    .update({ ...champs, updated_at: new Date().toISOString() }).eq('id', partId)
  if (error) console.error('[paiement-multi] Erreur maj part', partId, JSON.stringify(error))
}

async function annulerReservation(admin: ReturnType<typeof createAdminClient>, part: Part) {
  if (!part.stripe_payment_intent_id) return
  try {
    await stripe.paymentIntents.cancel(part.stripe_payment_intent_id, {}, { stripeAccount: part.stripe_account_id })
  } catch (err) {
    console.error('[paiement-multi] Annulation impossible', part.stripe_payment_intent_id, err instanceof Error ? err.message : err)
  }
  await majPart(admin, part.id, { statut: 'annulee' })
}

async function rembourserPart(admin: ReturnType<typeof createAdminClient>, part: Part) {
  if (!part.stripe_payment_intent_id) return
  try {
    await stripe.refunds.create({ payment_intent: part.stripe_payment_intent_id }, { stripeAccount: part.stripe_account_id })
    await majPart(admin, part.id, { statut: 'remboursee' })
  } catch (err) {
    console.error('[paiement-multi] Remboursement impossible', part.stripe_payment_intent_id, err instanceof Error ? err.message : err)
  }
}

/** Annule tout ce qui a été réservé et rembourse ce qui aurait déjà été encaissé. */
async function toutDefaire(admin: ReturnType<typeof createAdminClient>, tentativeId: string, statutFinal: 'echouee' | 'expiree') {
  const { parts } = await lireTentative(admin, tentativeId)
  for (const part of parts) {
    // a_reserver avec un PaymentIntent = part en attente de validation par la
    // banque (peut être passée « réservée » côté Stripe sans qu'on le sache).
    if (part.statut === 'reservee' || (part.statut === 'a_reserver' && part.stripe_payment_intent_id)) await annulerReservation(admin, part)
    else if (part.statut === 'capturee') await rembourserPart(admin, part)
    else if (part.statut === 'a_reserver') await majPart(admin, part.id, { statut: 'annulee' })
  }
  await admin.from('tentatives_paiement').update({ statut: statutFinal }).eq('id', tentativeId)
}

async function reserverPart(
  admin: ReturnType<typeof createAdminClient>,
  part: Part,
  ctx: { tentativeId: string; customerId: string; paymentMethodId: string; description: string },
): Promise<{ ok: true } | { ok: false; erreur: string } | { ok: false; validation: ValidationBanque }> {
  let copieId: string | null = null
  try {
    const copie = await stripe.paymentMethods.create(
      { customer: ctx.customerId, payment_method: ctx.paymentMethodId },
      { stripeAccount: part.stripe_account_id },
    )
    copieId = copie.id
    const paymentIntent = await stripe.paymentIntents.create({
      amount: part.montant_cents,
      currency: 'eur',
      payment_method: copie.id,
      payment_method_types: [copie.type],
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      description: ctx.description,
      metadata: { type: 'achat_multi', tentative_id: ctx.tentativeId, part_id: part.id },
    }, { stripeAccount: part.stripe_account_id })

    await majPart(admin, part.id, { stripe_payment_intent_id: paymentIntent.id })
    if (paymentIntent.status !== 'requires_capture') {
      await annulerReservation(admin, { ...part, stripe_payment_intent_id: paymentIntent.id })
      await majPart(admin, part.id, { statut: 'echouee', erreur: `statut inattendu : ${paymentIntent.status}` })
      return { ok: false, erreur: MESSAGE_ECHEC }
    }
    await majPart(admin, part.id, { statut: 'reservee', erreur: null })
    return { ok: true }
  } catch (err) {
    const e = err as { code?: string; message?: string; raw?: { payment_intent?: { id?: string } } }
    const piId = e.raw?.payment_intent?.id

    // Banque stricte : la réservation « client absent » est refusée faute de
    // validation — on la garde et on la fait valider à l'écran par le client.
    if (e.code === 'authentication_required' && piId && copieId) {
      try {
        // La copie vient d'être consommée par la tentative « client absent »
        // (usage unique, refusée ensuite par Stripe — vu en T6) : nouvelle
        // copie pour la validation à l'écran.
        const [pi, copieValidation] = await Promise.all([
          stripe.paymentIntents.retrieve(piId, {}, { stripeAccount: part.stripe_account_id }),
          stripe.paymentMethods.create(
            { customer: ctx.customerId, payment_method: ctx.paymentMethodId },
            { stripeAccount: part.stripe_account_id },
          ),
        ])
        if (pi.client_secret) {
          await majPart(admin, part.id, { stripe_payment_intent_id: piId, erreur: 'validation_requise' })
          return { ok: false, validation: { client_secret: pi.client_secret, stripe_account_id: part.stripe_account_id, payment_method_id: copieValidation.id } }
        }
      } catch (errLecture) {
        console.error('[paiement-multi] Lecture du paiement à valider impossible', piId, errLecture instanceof Error ? errLecture.message : errLecture)
      }
    }

    if (piId) {
      try { await stripe.paymentIntents.cancel(piId, {}, { stripeAccount: part.stripe_account_id }) } catch { /* déjà inutilisable */ }
    }
    console.error('[paiement-multi] Réservation refusée pour la part', part.id, ':', e.message)
    await majPart(admin, part.id, { statut: 'echouee', erreur: e.message ?? 'erreur inconnue', ...(piId ? { stripe_payment_intent_id: piId } : {}) })
    return { ok: false, erreur: messageErreurCarte(err) }
  }
}

/** Retour de la fenêtre de validation : la part n'est tenue que si la banque a validé. */
async function verifierValidation(admin: ReturnType<typeof createAdminClient>, part: Part): Promise<boolean> {
  try {
    const pi = await stripe.paymentIntents.retrieve(part.stripe_payment_intent_id!, {}, { stripeAccount: part.stripe_account_id })
    if (pi.status === 'requires_capture') {
      await majPart(admin, part.id, { statut: 'reservee', erreur: null })
      return true
    }
    await majPart(admin, part.id, { erreur: `validation non aboutie : ${pi.status}` })
  } catch (err) {
    console.error('[paiement-multi] Vérification de validation impossible', part.stripe_payment_intent_id, err instanceof Error ? err.message : err)
  }
  return false
}

async function capturerPart(admin: ReturnType<typeof createAdminClient>, part: Part): Promise<boolean> {
  try {
    await stripe.paymentIntents.capture(part.stripe_payment_intent_id!, {}, { stripeAccount: part.stripe_account_id })
    await majPart(admin, part.id, { statut: 'capturee' })
    return true
  } catch (err) {
    console.error('[paiement-multi] Capture refusée pour la part', part.id, ':', err instanceof Error ? err.message : err)
    return false
  }
}

/** Crée la commande et ses tranches une fois TOUTES les parts encaissées. */
async function creerCommande(admin: ReturnType<typeof createAdminClient>, tentative: Tentative, parts: Part[]): Promise<string | null> {
  if (tentative.commande_id) return tentative.commande_id

  const setupIntent = await stripe.setupIntents.retrieve(tentative.stripe_setup_intent_id, { expand: ['payment_method'] })
  const pm = setupIntent.payment_method as Stripe.PaymentMethod | null
  const adresse = pm?.billing_details?.address ?? null
  const totalCents = parts.reduce((s, p) => s + p.montant_cents, 0)

  const commandeId = await finaliserCommandePayee({
    meta: { ...(tentative.metadonnees ?? {}), beatmaker_id: tentative.beatmaker_id },
    tentativeColonne: 'stripe_setup_intent_id',
    tentativeValeur: tentative.stripe_setup_intent_id,
    acheteurEmail: tentative.email ?? pm?.billing_details?.email ?? null,
    acheteurNom: pm?.billing_details?.name ?? null,
    acheteurAdresse: adresse ? [adresse.line1, [adresse.postal_code, adresse.city].filter(Boolean).join(' '), adresse.country].filter(Boolean).join(', ') : null,
    acheteurAdresseRaw: adresse,
    acheteurTelephone: pm?.billing_details?.phone ?? null,
    totalCents,
    stripePaymentId: null,
    stripeSessionId: null,
    stripeAccountId: null,
    paiementMulti: true,
  })
  if (!commandeId) return null

  const { data: vendeurs } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, tva_active, tva_taux')
    .in('id', parts.map(p => p.vendeur_id))
  const vendeurMap = new Map((vendeurs ?? []).map(v => [v.id as string, v]))

  const tranches = parts.map(p => {
    const v = vendeurMap.get(p.vendeur_id)
    const taux = v?.tva_active && v?.tva_taux ? Number(v.tva_taux) : 0
    const { htCents, tvaCents } = decomposerTva(p.montant_cents, taux)
    const pcts = new Set(p.detail_lignes.map(d => d.pourcentage))
    return {
      commande_id: commandeId,
      vendeur_id: p.vendeur_id,
      vendeur_nom: v?.nom_artiste ?? 'Vendeur',
      est_proprietaire: p.est_proprietaire,
      quote_part_pct: pcts.size === 1 ? [...pcts][0] : null,
      montant_ttc_cents: p.montant_cents,
      tva_taux: taux,
      montant_tva_cents: tvaCents,
      montant_ht_cents: htCents,
      stripe_account_id: p.stripe_account_id,
      stripe_payment_intent_id: p.stripe_payment_intent_id,
      statut: 'payee',
      detail_lignes: p.detail_lignes,
    }
  })
  const { error } = await admin.from('commande_tranches').insert(tranches)
  if (error) console.error('[paiement-multi] Erreur insert commande_tranches pour', commandeId, JSON.stringify(error))

  return commandeId
}

/**
 * Paie une tentative dont la carte vient d'être enregistrée (SetupIntent
 * confirmé côté navigateur). Verrou : une seule exécution à la fois par
 * tentative (double clic, rechargement) — la seconde renvoie la commande déjà
 * créée ou « paiement déjà en cours ».
 * Si la banque exige une validation pour une part, la tentative repasse en
 * « creee » (seul état qui peut reprendre) et la validation est renvoyée au
 * navigateur ; l'appel suivant reprend là où il s'était arrêté.
 */
export async function payerTentativeMulti(setupIntentId: string): Promise<ResultatPaiementMulti> {
  const admin = createAdminClient()

  const { data: tentativeRow } = await admin
    .from('tentatives_paiement').select('id').eq('stripe_setup_intent_id', setupIntentId).eq('type', 'achat_multi').maybeSingle()
  if (!tentativeRow) return { ok: false, erreur: 'Paiement introuvable', status: 404 }
  const tentativeId = tentativeRow.id as string

  const { data: verrou } = await admin
    .from('tentatives_paiement').update({ statut: 'en_cours' })
    .eq('id', tentativeId).eq('statut', 'creee').select('id')
  if (!verrou?.length) {
    const { tentative } = await lireTentative(admin, tentativeId)
    if (tentative?.statut === 'complete' && tentative.commande_id) return { ok: true, commandeId: tentative.commande_id }
    if (tentative?.statut === 'en_cours') return { ok: false, erreur: 'Ton paiement est déjà en cours de traitement.', status: 409 }
    return { ok: false, erreur: 'Ce paiement n’est plus valable, recommence depuis ton panier.', status: 410 }
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
  const paymentMethodId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id
  const customerId = typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id
  if (setupIntent.status !== 'succeeded' || !paymentMethodId || !customerId) {
    await admin.from('tentatives_paiement').update({ statut: 'creee' }).eq('id', tentativeId)
    return { ok: false, erreur: 'La carte n’a pas été validée. Réessaie.', status: 400 }
  }

  const { tentative, parts } = await lireTentative(admin, tentativeId)
  if (!tentative || parts.length === 0) return { ok: false, erreur: MESSAGE_ECHEC, status: 500 }

  const { data: boutique } = await admin.from('beatmakers').select('nom_artiste').eq('id', tentative.beatmaker_id).maybeSingle()
  const description = `Achat sur la boutique ${boutique?.nom_artiste ?? ''}`.trim()

  for (const [index, part] of parts.entries()) {
    if (part.statut === 'reservee') continue
    if (part.statut === 'a_reserver' && part.stripe_payment_intent_id) {
      if (!(await verifierValidation(admin, part))) {
        await toutDefaire(admin, tentativeId, 'echouee')
        return { ok: false, erreur: MESSAGE_VALIDATION_ECHOUEE, status: 402 }
      }
      continue
    }
    const r = await reserverPart(admin, part, { tentativeId, customerId, paymentMethodId, description })
    if ('validation' in r) {
      await admin.from('tentatives_paiement').update({ statut: 'creee' }).eq('id', tentativeId)
      return { ok: false, validation: { ...r.validation, numero: index + 1, total: parts.length }, status: 200 }
    }
    if (!r.ok) {
      await toutDefaire(admin, tentativeId, 'echouee')
      return { ok: false, erreur: r.erreur, status: 402 }
    }
  }

  const { parts: reservees } = await lireTentative(admin, tentativeId)
  for (const part of reservees) {
    if (!(await capturerPart(admin, part))) {
      await toutDefaire(admin, tentativeId, 'echouee')
      return { ok: false, erreur: MESSAGE_ECHEC, status: 402 }
    }
  }

  const { parts: capturees } = await lireTentative(admin, tentativeId)
  const commandeId = await creerCommande(admin, tentative, capturees)
  if (!commandeId) {
    // Argent encaissé mais commande non créée : le balayage réessaiera.
    return { ok: false, erreur: 'Paiement reçu — ta commande est en cours de préparation, tu recevras un email de confirmation.', status: 202 }
  }
  return { ok: true, commandeId }
}

/**
 * Abandon d'une tentative pas encore en train d'encaisser (fenêtre de
 * validation fermée, page rechargée) : tout ce qui a été réservé est annulé
 * tout de suite, sans attendre le balayage. Le passage « creee → expiree » est
 * atomique : un appel à payer arrivé en même temps ne peut plus démarrer.
 */
export async function abandonnerTentativeMulti(setupIntentId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tentatives_paiement').update({ statut: 'expiree' })
    .eq('stripe_setup_intent_id', setupIntentId).eq('type', 'achat_multi').eq('statut', 'creee')
    .select('id')
  if (!data?.length) return false
  await toutDefaire(admin, data[0].id as string, 'expiree')
  return true
}

export type EtatPaiement =
  | { etat: 'termine'; commandeId: string }
  | { etat: 'en_cours'; paye: boolean }
  | { etat: 'abandonne' }
  | { etat: 'interrompu' }

/**
 * Où en est un paiement réparti après un rechargement de page. `annuler` :
 * seul l'onglet qui a lancé le paiement peut abandonner une tentative
 * interrompue (un autre onglet ouvert en même temps n'y touche pas).
 */
export async function etatTentativeMulti(setupIntentId: string, annuler: boolean): Promise<EtatPaiement> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('tentatives_paiement').select('id').eq('stripe_setup_intent_id', setupIntentId).eq('type', 'achat_multi').maybeSingle()
  if (!row) return { etat: 'abandonne' }
  const { tentative, parts } = await lireTentative(admin, row.id as string)
  if (!tentative) return { etat: 'abandonne' }

  if (tentative.commande_id) return { etat: 'termine', commandeId: tentative.commande_id }
  if (tentative.statut === 'en_cours') return { etat: 'en_cours', paye: parts.some(p => p.statut === 'capturee') }
  if (tentative.statut === 'creee') {
    if (!annuler) return { etat: 'interrompu' }
    if (await abandonnerTentativeMulti(setupIntentId)) return { etat: 'abandonne' }
    return etatTentativeMulti(setupIntentId, false)
  }
  return { etat: 'abandonne' }
}

/**
 * Balayage des paiements répartis restés en plan (page fermée, coupure au
 * mauvais moment). Si toutes les parts sont au moins réservées et que l'une
 * a déjà été encaissée, on termine la vente (encaissement du reste + commande)
 * — sinon on annule tout, le client n'est débité de rien.
 */
export async function balayerPaiementsMulti(ageMinutes = 30): Promise<{ terminees: number; annulees: number }> {
  const admin = createAdminClient()
  const seuil = new Date(Date.now() - ageMinutes * 60 * 1000).toISOString()
  const { data: enPlan } = await admin
    .from('tentatives_paiement').select('id, statut')
    .eq('type', 'achat_multi').in('statut', ['creee', 'en_cours']).lt('created_at', seuil)

  let terminees = 0
  let annulees = 0
  for (const t of enPlan ?? []) {
    const { tentative, parts } = await lireTentative(admin, t.id as string)
    if (!tentative) continue
    const toutesTenues = parts.length > 0 && parts.every(p => p.statut === 'reservee' || p.statut === 'capturee')
    const uneEncaissee = parts.some(p => p.statut === 'capturee')

    if (toutesTenues && uneEncaissee) {
      let ok = true
      for (const p of parts.filter(p => p.statut === 'reservee')) ok = (await capturerPart(admin, p)) && ok
      if (ok) {
        const { parts: capturees } = await lireTentative(admin, tentative.id)
        if (await creerCommande(admin, tentative, capturees)) { terminees++; continue }
      }
      console.error('[paiement-multi] Balayage : vente non terminée pour la tentative', tentative.id, '— à vérifier')
      continue
    }

    await toutDefaire(admin, tentative.id, t.statut === 'creee' ? 'expiree' : 'echouee')
    annulees++
  }
  return { terminees, annulees }
}
