import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { emettreAvoir } from './avoirs'
import {
  envoyerRemboursementClient,
  envoyerAnnulationClient,
  envoyerRemboursementVente,
  envoyerRemboursementIncomplet,
} from './emails'

type Admin = ReturnType<typeof createAdminClient>

// Remboursements, annulation et licence annulée — Phase 13, lot 4a. Règles
// (grill-me du 2026-09-28 + cadrage L4 du 2026-09-30) :
// - s'il y a de l'argent, on rembourse la commande ENTIÈRE (jamais un beat
//   seul) ; sans argent, rien à rembourser → « Annuler la commande » ;
// - en collab, chaque vendeur rend SA part depuis son compte Stripe, sans
//   arrondi ; une part en échec n'annule pas les autres (« Remboursement
//   incomplet », « Réessayer » ne relance que ce qui reste) ;
// - dès qu'une part revient au client, la licence n'est plus payée en entier :
//   elle tombe (fichiers fermés, Exclusive remise en vente), A garde sa part
//   si ce n'est pas lui qui a remboursé ;
// - un avoir par vendeur qui avait une facture.
// Les remboursements lancés par la plateforme portent metadata.origine =
// 'my_producer' : le webhook des comptes connectés les reconnaît et ne les
// traite pas une deuxième fois comme un remboursement fait depuis Stripe.

export const ORIGINE_REMBOURSEMENT = 'my_producer'

export type MotifLicenceAnnulee = 'remboursement' | 'annulation' | 'remboursement_vendeur' | 'litige_perdu'

type Tranche = {
  id: string
  vendeur_id: string | null
  vendeur_nom: string
  est_proprietaire: boolean
  montant_ttc_cents: number
  montant_rembourse_cents: number
  frais_stripe_cents: number | null
  stripe_account_id: string | null
  stripe_payment_intent_id: string | null
  statut: string
}

type Commande = {
  id: string
  beatmaker_id: string
  statut: string
  prix_paye: number
  type_commande: string | null
  stripe_payment_id: string | null
  stripe_account_id: string | null
  montant_rembourse_cents: number
  licence_annulee_at: string | null
}

const SELECT_COMMANDE = 'id, beatmaker_id, statut, prix_paye, type_commande, stripe_payment_id, stripe_account_id, montant_rembourse_cents, licence_annulee_at'
const SELECT_TRANCHE = 'id, vendeur_id, vendeur_nom, est_proprietaire, montant_ttc_cents, montant_rembourse_cents, frais_stripe_cents, stripe_account_id, stripe_payment_intent_id, statut'

// Commandes d'abonnement : hors périmètre (encaissées par l'ancien circuit
// plateforme, jamais sur le compte du vendeur).
const TYPES_ABONNEMENT = new Set(['CREATION_ABONNEMENT', 'RENOUVELLEMENT'])

export const STATUTS_REMBOURSABLES = new Set(['payee', 'remboursement_incomplet', 'remboursee_partielle'])

async function lireCommande(admin: Admin, commandeId: string) {
  const [{ data: commande }, { data: tranches }] = await Promise.all([
    admin.from('commandes').select(SELECT_COMMANDE).eq('id', commandeId).maybeSingle(),
    admin.from('commande_tranches').select(SELECT_TRANCHE).eq('commande_id', commandeId).order('est_proprietaire', { ascending: false }),
  ])
  return { commande: commande as Commande | null, tranches: (tranches ?? []) as Tranche[] }
}

const centsCommande = (c: Commande) => Math.round(Number(c.prix_paye) * 100)

// Ce que Stripe a réellement encaissé et rendu sur un paiement — seule source
// de vérité (jamais notre base, qui peut être en retard d'un événement).
async function etatPaiement(paymentIntentId: string, compte: string) {
  const pi = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ['latest_charge.balance_transaction'] },
    { stripeAccount: compte },
  )
  const charge = pi.latest_charge as Stripe.Charge | null
  const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null
  return {
    encaisseCents: charge?.amount ?? 0,
    rembourseCents: charge?.amount_refunded ?? 0,
    fraisCents: bt?.fee ?? null,
  }
}

// ============================================================
// Licence annulée : fichiers fermés + Exclusive remise en vente
// ============================================================
export async function annulerLicence(admin: Admin, commandeId: string, motif: MotifLicenceAnnulee): Promise<boolean> {
  const { data: maj } = await admin
    .from('commandes')
    .update({ licence_annulee_at: new Date().toISOString(), licence_annulee_motif: motif })
    .eq('id', commandeId)
    .is('licence_annulee_at', null)
    .select('id')
  if (!maj?.length) return false

  // Exclusive (Phase 6) : le beat avait été retiré de la vente (statut
  // 'vendu') ; la licence tombe → il revient en vente automatiquement
  // (décision de Jake, 2026-09-30). Un beat remis autrement entre-temps
  // (supprimé, masqué…) n'est pas touché.
  const { data: lignes } = await admin
    .from('commande_lignes')
    .select('beat_id, licence_modele, licences(est_exclusive)')
    .eq('commande_id', commandeId)
  type Ligne = { beat_id: string; licence_modele: string | null; licences: { est_exclusive: boolean } | null }
  const beatsExclusifs = ((lignes ?? []) as unknown as Ligne[])
    .filter(l => l.licences?.est_exclusive || l.licence_modele === 'exclusive')
    .map(l => l.beat_id)
  if (beatsExclusifs.length) {
    const { error } = await admin.from('beats').update({ statut: 'public' }).in('id', beatsExclusifs).eq('statut', 'vendu')
    if (error) console.error('[remboursement] Remise en vente Exclusive impossible:', JSON.stringify(error))
  }
  return true
}

// Statut de la commande d'après ce qui a vraiment été rendu. Un litige en
// cours n'est jamais écrasé ici (lot 4b).
async function recalculerStatut(admin: Admin, commandeId: string) {
  const { commande, tranches } = await lireCommande(admin, commandeId)
  if (!commande || commande.statut === 'litige') return commande?.statut ?? null

  let encaisseCents: number
  let rembourseCents: number
  let echec = false
  if (tranches.length) {
    const avecArgent = tranches.filter(t => t.montant_ttc_cents > 0)
    encaisseCents = avecArgent.reduce((s, t) => s + t.montant_ttc_cents, 0)
    rembourseCents = avecArgent.reduce((s, t) => s + Math.min(t.montant_rembourse_cents, t.montant_ttc_cents), 0)
    echec = tranches.some(t => t.statut === 'remboursement_echoue')
  } else {
    encaisseCents = centsCommande(commande)
    rembourseCents = commande.montant_rembourse_cents
  }

  let statut = commande.statut
  if (encaisseCents > 0 && rembourseCents >= encaisseCents) statut = 'remboursee'
  else if (echec) statut = 'remboursement_incomplet'
  else if (rembourseCents > 0) statut = 'remboursee_partielle'

  const { error } = await admin.from('commandes').update({
    statut,
    montant_rembourse: rembourseCents / 100,
    ...(tranches.length ? { montant_rembourse_cents: rembourseCents } : {}),
  }).eq('id', commandeId)
  if (error) {
    console.error('[remboursement] Statut de la commande non enregistré', commandeId, statut, JSON.stringify(error))
    throw new Error(`Statut de la commande non enregistré (${error.message})`)
  }
  return statut
}

// ============================================================
// Aperçu avant le clic (fenêtre de confirmation de A)
// ============================================================
export type ApercuRemboursement = {
  action: 'rembourser' | 'annuler' | 'aucune'
  raison?: string
  parts: {
    vendeurNom: string
    estProprietaire: boolean
    montantCents: number
    fraisCents: number | null
    compteUtilisable: boolean
    dejaRembourse: boolean
  }[]
  totalCents: number
  telechargeLe: string | null
}

export async function apercuRemboursement(admin: Admin, commandeId: string): Promise<ApercuRemboursement> {
  const { commande, tranches } = await lireCommande(admin, commandeId)
  const vide = (raison: string): ApercuRemboursement => ({ action: 'aucune', raison, parts: [], totalCents: 0, telechargeLe: null })
  if (!commande) return vide('Commande introuvable')
  if (TYPES_ABONNEMENT.has(commande.type_commande ?? '')) return vide("Les paiements d'abonnement ne se remboursent pas depuis cette page.")

  const { data: dl } = await admin
    .from('licence_downloads')
    .select('downloaded_at')
    .eq('commande_id', commandeId)
    .neq('fichier', 'email_renvoi')
    .order('downloaded_at', { ascending: true })
    .limit(1)
  const telechargeLe = dl?.[0]?.downloaded_at ?? null

  if (centsCommande(commande) === 0) {
    if (commande.statut !== 'payee') return vide('Commande déjà annulée.')
    return { action: 'annuler', parts: [], totalCents: 0, telechargeLe }
  }
  if (!STATUTS_REMBOURSABLES.has(commande.statut)) return vide('Cette commande ne peut pas être remboursée dans son état actuel.')

  if (!tranches.length) {
    if (!commande.stripe_payment_id || !commande.stripe_account_id) {
      return vide('Vente antérieure au paiement direct : hors périmètre du remboursement automatique.')
    }
    const { data: bm } = await admin.from('beatmakers').select('nom_artiste').eq('id', commande.beatmaker_id).maybeSingle()
    let fraisCents: number | null = null
    let resteCents = centsCommande(commande) - commande.montant_rembourse_cents
    try {
      const etat = await etatPaiement(commande.stripe_payment_id, commande.stripe_account_id)
      fraisCents = etat.fraisCents
      resteCents = etat.encaisseCents - etat.rembourseCents
    } catch (err) {
      console.error('[remboursement] Aperçu : lecture Stripe impossible', err instanceof Error ? err.message : err)
    }
    return {
      action: resteCents > 0 ? 'rembourser' : 'aucune',
      raison: resteCents > 0 ? undefined : 'Tout a déjà été remboursé.',
      parts: [{ vendeurNom: bm?.nom_artiste ?? 'Toi', estProprietaire: true, montantCents: resteCents, fraisCents, compteUtilisable: true, dejaRembourse: false }],
      totalCents: resteCents,
      telechargeLe,
    }
  }

  const vendeurIds = tranches.map(t => t.vendeur_id).filter((v): v is string => !!v)
  const { data: vendeurs } = await admin.from('beatmakers').select('id, stripe_compte_operationnel').in('id', vendeurIds)
  const operationnel = new Map((vendeurs ?? []).map(v => [v.id as string, !!v.stripe_compte_operationnel]))

  const parts = tranches
    .filter(t => t.montant_ttc_cents > 0)
    .map(t => {
      const reste = Math.max(t.montant_ttc_cents - t.montant_rembourse_cents, 0)
      return {
        vendeurNom: t.vendeur_nom,
        estProprietaire: t.est_proprietaire,
        montantCents: reste,
        fraisCents: t.frais_stripe_cents,
        compteUtilisable: !t.vendeur_id || (operationnel.get(t.vendeur_id) ?? false),
        dejaRembourse: reste === 0,
      }
    })
  const totalCents = parts.reduce((s, p) => s + p.montantCents, 0)
  return {
    action: totalCents > 0 ? 'rembourser' : 'aucune',
    raison: totalCents > 0 ? undefined : 'Tout a déjà été remboursé.',
    parts,
    totalCents,
    telechargeLe,
  }
}

// ============================================================
// Remboursement par le bouton de A (et « Réessayer »)
// ============================================================
export type ResultatRemboursement = {
  ok: boolean
  statut: string | null
  erreur?: string
  echecs: { vendeurNom: string; erreur: string }[]
}

async function prendreVerrou(admin: Admin, commandeId: string): Promise<boolean> {
  const maintenant = new Date()
  const expire = new Date(maintenant.getTime() - 2 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('commandes')
    .update({ remboursement_verrou_at: maintenant.toISOString() })
    .eq('id', commandeId)
    .or(`remboursement_verrou_at.is.null,remboursement_verrou_at.lt."${expire}"`)
    .select('id')
  return !!data?.length
}

async function rendreVerrou(admin: Admin, commandeId: string) {
  await admin.from('commandes').update({ remboursement_verrou_at: null }).eq('id', commandeId)
}

function messageStripe(err: unknown): string {
  return err instanceof Error ? err.message : 'Erreur Stripe inconnue'
}

async function rembourserPaiement(paymentIntentId: string, compte: string, meta: Record<string, string>) {
  const etat = await etatPaiement(paymentIntentId, compte)
  const reste = etat.encaisseCents - etat.rembourseCents
  if (reste <= 0) return { refundId: null as string | null, montantCents: 0, dejaFait: true }
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntentId, amount: reste, metadata: { origine: ORIGINE_REMBOURSEMENT, ...meta } },
    { stripeAccount: compte },
  )
  if (refund.status === 'failed' || refund.status === 'canceled') {
    throw new Error(`Remboursement refusé par Stripe (${refund.failure_reason ?? refund.status})`)
  }
  return { refundId: refund.id, montantCents: refund.amount, dejaFait: false }
}

export async function rembourserCommande(admin: Admin, commandeId: string): Promise<ResultatRemboursement> {
  const refus = (erreur: string): ResultatRemboursement => ({ ok: false, statut: null, erreur, echecs: [] })
  const { commande, tranches } = await lireCommande(admin, commandeId)
  if (!commande) return refus('Commande introuvable')
  if (TYPES_ABONNEMENT.has(commande.type_commande ?? '')) return refus("Les paiements d'abonnement ne se remboursent pas depuis cette page.")
  if (centsCommande(commande) === 0) return refus('Commande gratuite : rien à rembourser, utilise « Annuler la commande ».')
  if (!STATUTS_REMBOURSABLES.has(commande.statut)) return refus('Cette commande ne peut pas être remboursée dans son état actuel.')
  if (!tranches.length && (!commande.stripe_payment_id || !commande.stripe_account_id)) {
    return refus('Vente antérieure au paiement direct : hors périmètre du remboursement automatique.')
  }

  if (!(await prendreVerrou(admin, commandeId))) return refus('Un remboursement est déjà en cours sur cette commande.')

  try {
    const maintenant = () => new Date().toISOString()
    const echecs: { trancheId: string; vendeurNom: string; erreur: string }[] = []
    const rembourses: { tranche: Tranche | null; montantCents: number }[] = []

    if (!tranches.length) {
      // Vente solo : un seul paiement, sur le compte de A.
      try {
        const r = await rembourserPaiement(commande.stripe_payment_id!, commande.stripe_account_id!, { commande_id: commandeId })
        await admin.from('commandes').update({
          montant_rembourse_cents: centsCommande(commande),
          ...(r.refundId ? { stripe_refund_id: r.refundId } : {}),
          rembourse_at: maintenant(),
        }).eq('id', commandeId)
        if (r.montantCents > 0) {
          rembourses.push({ tranche: null, montantCents: r.montantCents })
          await emettreAvoir(admin, { commandeId, trancheId: null, montantCents: r.montantCents, motif: 'remboursement', sourceStripeId: r.refundId! })
        }
      } catch (err) {
        // Rien n'a bougé : la commande reste payée, la licence reste valable.
        console.error('[remboursement] Échec remboursement solo', commandeId, messageStripe(err))
        return refus(`Stripe a refusé le remboursement : ${messageStripe(err)}`)
      }
    } else {
      for (const t of tranches) {
        if (t.statut === 'remboursee') continue
        // Part à 0 € (beat offert) : rien à rendre, jamais d'appel Stripe.
        if (t.montant_ttc_cents === 0 || !t.stripe_payment_intent_id || !t.stripe_account_id) {
          if (t.montant_ttc_cents === 0) {
            await admin.from('commande_tranches').update({ statut: 'remboursee', rembourse_at: maintenant(), rembourse_par: 'proprietaire' }).eq('id', t.id)
          }
          continue
        }
        try {
          const r = await rembourserPaiement(t.stripe_payment_intent_id, t.stripe_account_id, { commande_id: commandeId, tranche_id: t.id })
          await admin.from('commande_tranches').update({
            montant_rembourse_cents: t.montant_ttc_cents,
            statut: 'remboursee',
            ...(r.refundId ? { stripe_refund_id: r.refundId } : {}),
            remboursement_erreur: null,
            rembourse_at: maintenant(),
            rembourse_par: 'proprietaire',
          }).eq('id', t.id)
          if (r.montantCents > 0) {
            rembourses.push({ tranche: t, montantCents: r.montantCents })
            await emettreAvoir(admin, { commandeId, trancheId: t.id, montantCents: r.montantCents, motif: 'remboursement', sourceStripeId: r.refundId! })
          }
        } catch (err) {
          const erreur = messageStripe(err)
          console.error('[remboursement] Échec part', t.id, erreur)
          await admin.from('commande_tranches').update({ statut: 'remboursement_echoue', remboursement_erreur: erreur }).eq('id', t.id)
          echecs.push({ trancheId: t.id, vendeurNom: t.vendeur_nom, erreur })
        }
      }
    }

    const statut = await recalculerStatut(admin, commandeId)
    // A a décidé de rembourser : la licence tombe dès qu'une part est rendue,
    // même si une autre a échoué (décision L4-Q3). Rien rendu du tout (tout
    // en échec) : le client a toujours tout payé, la licence reste.
    const rienRendu = rembourses.length === 0 && tranches.every(t => t.montant_ttc_cents === 0 || t.montant_rembourse_cents === 0)
    if (!(rienRendu && echecs.length)) await annulerLicence(admin, commandeId, 'remboursement')

    const totalRenduCents = rembourses.reduce((s, r) => s + r.montantCents, 0)
    if (totalRenduCents > 0) {
      const nonRembourses = tranches
        .filter(t => echecs.some(e => e.trancheId === t.id))
        .map(t => ({ vendeurNom: t.vendeur_nom, montantCents: t.montant_ttc_cents - t.montant_rembourse_cents }))
      await envoyerRemboursementClient({ commandeId, montantCents: totalRenduCents, nonRembourses })
        .catch(err => console.error('[remboursement] Email client:', err))
    }
    for (const r of rembourses) {
      if (r.tranche && !r.tranche.est_proprietaire && r.tranche.vendeur_id) {
        await envoyerRemboursementVente({ commandeId, trancheId: r.tranche.id })
          .catch(err => console.error('[remboursement] Email vendeur:', err))
      }
    }
    if (echecs.length) {
      await envoyerRemboursementIncomplet({ commandeId })
        .catch(err => console.error('[remboursement] Email remboursement incomplet:', err))
    }

    return { ok: echecs.length === 0, statut, echecs: echecs.map(e => ({ vendeurNom: e.vendeurNom, erreur: e.erreur })) }
  } finally {
    await rendreVerrou(admin, commandeId)
  }
}

// ============================================================
// Annulation d'une commande à 0 € (rien à rembourser)
// ============================================================
export async function annulerCommande(admin: Admin, commandeId: string): Promise<{ ok: boolean; erreur?: string }> {
  const { commande, tranches } = await lireCommande(admin, commandeId)
  if (!commande) return { ok: false, erreur: 'Commande introuvable' }
  if (centsCommande(commande) > 0) return { ok: false, erreur: 'Commande payante : utilise « Remboursement ».' }
  if (commande.statut !== 'payee') return { ok: false, erreur: 'Commande déjà annulée.' }

  const { data: maj } = await admin.from('commandes').update({ statut: 'annulee' }).eq('id', commandeId).eq('statut', 'payee').select('id')
  if (!maj?.length) return { ok: false, erreur: 'Commande déjà annulée.' }
  if (tranches.length) {
    await admin.from('commande_tranches').update({ statut: 'annulee' }).eq('commande_id', commandeId)
  }
  await annulerLicence(admin, commandeId, 'annulation')
  await envoyerAnnulationClient({ commandeId }).catch(err => console.error('[remboursement] Email annulation client:', err))
  return { ok: true }
}

// ============================================================
// Webhook des comptes connectés : remboursement fait depuis Stripe
// ============================================================
// Un vendeur (B, ou A lui-même) qui rembourse depuis son espace Stripe
// (décisions L4-Q3 bis/ter) : la part est rendue au client, donc la licence
// n'est plus payée en entier → elle tombe, un avoir est émis pour CE vendeur,
// A garde sa part. Un remboursement lancé par la plateforme qui échoue après
// coup (asynchrone) repasse la part en échec.
export async function traiterRemboursementStripe(refund: Stripe.Refund, compte: string) {
  const paymentIntentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id
  if (!paymentIntentId) return
  const admin = createAdminClient()

  const { data: trancheRow } = await admin
    .from('commande_tranches')
    .select(`${SELECT_TRANCHE}, commande_id`)
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('stripe_account_id', compte)
    .maybeSingle()
  let commandeId: string | null = (trancheRow as { commande_id?: string } | null)?.commande_id ?? null
  const tranche = trancheRow as (Tranche & { commande_id: string }) | null
  if (!commandeId) {
    const { data: c } = await admin
      .from('commandes')
      .select('id')
      .eq('stripe_payment_id', paymentIntentId)
      .eq('stripe_account_id', compte)
      .maybeSingle()
    commandeId = c?.id ?? null
  }
  // Paiement sans commande (réservation annulée pendant le paiement…) : rien à refléter.
  if (!commandeId) return

  const etat = await etatPaiement(paymentIntentId, compte)
  const lancePlateforme = refund.metadata?.origine === ORIGINE_REMBOURSEMENT

  if (refund.status === 'failed' || refund.status === 'canceled') {
    if (!lancePlateforme) return
    // Remboursement lancé par le bouton de A, refusé après coup par Stripe.
    if (tranche) {
      await admin.from('commande_tranches').update({
        montant_rembourse_cents: Math.min(etat.rembourseCents, tranche.montant_ttc_cents),
        statut: 'remboursement_echoue',
        remboursement_erreur: `Remboursement refusé par Stripe (${refund.failure_reason ?? refund.status})`,
      }).eq('id', tranche.id)
    } else {
      await admin.from('commandes').update({ montant_rembourse_cents: etat.rembourseCents }).eq('id', commandeId)
    }
    await recalculerStatut(admin, commandeId)
    await envoyerRemboursementIncomplet({ commandeId }).catch(err => console.error('[remboursement] Email échec asynchrone:', err))
    return
  }

  // Lancé par la plateforme : déjà enregistré par rembourserCommande.
  if (lancePlateforme) return
  if (refund.status !== 'succeeded' && refund.status !== 'pending') return

  if (tranche) {
    const rembourse = Math.min(etat.rembourseCents, tranche.montant_ttc_cents)
    if (rembourse <= tranche.montant_rembourse_cents) return
    await admin.from('commande_tranches').update({
      montant_rembourse_cents: rembourse,
      statut: rembourse >= tranche.montant_ttc_cents ? 'remboursee' : 'remboursee_partielle',
      stripe_refund_id: refund.id,
      remboursement_erreur: null,
      rembourse_at: new Date().toISOString(),
      rembourse_par: 'vendeur_stripe',
    }).eq('id', tranche.id)
  } else {
    const { data: c } = await admin.from('commandes').select('montant_rembourse_cents').eq('id', commandeId).single()
    if (etat.rembourseCents <= (c?.montant_rembourse_cents ?? 0)) return
    await admin.from('commandes').update({
      montant_rembourse_cents: etat.rembourseCents,
      stripe_refund_id: refund.id,
      rembourse_at: new Date().toISOString(),
    }).eq('id', commandeId)
  }

  await emettreAvoir(admin, {
    commandeId,
    trancheId: tranche?.id ?? null,
    montantCents: refund.amount,
    motif: 'remboursement_vendeur',
    sourceStripeId: refund.id,
  })
  await recalculerStatut(admin, commandeId)
  await annulerLicence(admin, commandeId, 'remboursement_vendeur')
  await envoyerRemboursementClient({ commandeId, montantCents: refund.amount, nonRembourses: [] })
    .catch(err => console.error('[remboursement] Email client (remboursement Stripe):', err))
}
