import type Stripe from 'stripe'
import { PDFDocument } from 'pdf-lib'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { emettreAvoir } from './avoirs'
import { annulerLicence, recalculerStatut, prendreVerrou, rendreVerrou, STATUTS_REMBOURSABLES, ORIGINE_REMBOURSEMENT } from './remboursement'
import { envoyerLitigeOuvert, envoyerLitigeCollaborateur, envoyerLitigeRappel, type PartLitigeEmail } from './emails'
import { lirePdfR2 } from './livraison'
import { fuseauSur, formatDateTz, formatDateTimeTz } from './fuseau-horaire'

type Admin = ReturnType<typeof createAdminClient>

// Litiges (Phase 13, lot 4b — décisions Q6 du grill-me, L4-Q3 ter, L4-Q5) :
// - un litige Stripe porte sur UN paiement : en collab, une part (le compte
//   de B reçoit son propre litige) ; montant et suivi par part ;
// - A gère le litige de toute la vente : il envoie la réponse (preuves prêtes
//   + son texte/fichier) sur le compte de chaque vendeur, ou accepte le
//   litige. S'il ne fait rien : RIEN n'est envoyé automatiquement ;
// - B peut répondre lui-même depuis Stripe (Stripe l'impose) : la réponse
//   est définitive, A ne peut plus répondre pour cette part et le voit ;
// - litige en cours : rien ne change (fichiers ouverts, Exclusive hors vente) ;
// - gagné : la commande revient à son état normal ;
// - perdu : la part est reprise, avoir pour ce vendeur (litige_perdu), la
//   licence n'est plus payée en entier → elle tombe ; l'autre vendeur garde
//   sa part.

// Commande pas encore créée quand le litige arrive (carte de test qui
// conteste instantanément) : on répond en erreur pour que Stripe renvoie
// l'événement plus tard, au lieu de perdre le litige.
export class LitigeARejouer extends Error {}

type LigneLitige = {
  id: string
  commande_id: string
  beatmaker_id: string
  tranche_id: string | null
  stripe_account_id: string | null
  stripe_dispute_id: string
  montant: number
  statut: 'en_cours' | 'gagne' | 'perdu'
  motif: string | null
  date_limite: string | null
  reponse_par: 'proprietaire' | 'vendeur_stripe' | 'acceptation' | null
  reponse_envoyee_at: string | null
  reponse_erreur: string | null
  ouvert_le: string
  ferme_le: string | null
}

const SELECT_LITIGE = 'id, commande_id, beatmaker_id, tranche_id, stripe_account_id, stripe_dispute_id, montant, statut, motif, date_limite, reponse_par, reponse_envoyee_at, reponse_erreur, ouvert_le, ferme_le'

// Statuts Stripe où une réponse (ou une acceptation) est encore possible.
const STATUTS_REPONSE_POSSIBLE = new Set(['needs_response', 'warning_needs_response'])

function idPaymentIntent(dispute: Stripe.Dispute): string | null {
  return typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id ?? null
}

const dateLimite = (d: Stripe.Dispute) => d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toISOString() : null

// La réponse déjà envoyée chez Stripe : par la plateforme (bouton de A,
// marquée metadata.origine) ou par le vendeur depuis son espace Stripe.
function reponseDejaEnvoyee(d: Stripe.Dispute): 'proprietaire' | 'vendeur_stripe' | null {
  if ((d.evidence_details?.submission_count ?? 0) === 0) return null
  return d.metadata?.origine === ORIGINE_REMBOURSEMENT ? 'proprietaire' : 'vendeur_stripe'
}

async function trouverPaiement(admin: Admin, paymentIntentId: string, compte: string) {
  const { data: tranche } = await admin
    .from('commande_tranches')
    .select('id, commande_id, vendeur_id, vendeur_nom, est_proprietaire, montant_ttc_cents')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('stripe_account_id', compte)
    .maybeSingle()
  if (tranche) return { commandeId: tranche.commande_id as string, tranche }
  const { data: commande } = await admin
    .from('commandes')
    .select('id')
    .eq('stripe_payment_id', paymentIntentId)
    .eq('stripe_account_id', compte)
    .maybeSingle()
  return commande ? { commandeId: commande.id as string, tranche: null } : null
}

async function nomsVendeurs(admin: Admin, lignes: LigneLitige[]): Promise<Map<string, string>> {
  const ids = [...new Set(lignes.map(l => l.beatmaker_id))]
  if (!ids.length) return new Map()
  const { data } = await admin.from('beatmakers').select('id, nom_artiste').in('id', ids)
  return new Map((data ?? []).map(b => [b.id as string, (b.nom_artiste as string) ?? '']))
}

async function partsPourEmail(admin: Admin, lignes: LigneLitige[]): Promise<PartLitigeEmail[]> {
  const noms = await nomsVendeurs(admin, lignes)
  return lignes.map(l => ({ vendeurNom: noms.get(l.beatmaker_id) ?? '', montant: Number(l.montant), motif: l.motif, dateLimite: l.date_limite }))
}

// ============================================================
// Ouverture (charge.dispute.created, et rattrapage via charge.dispute.updated)
// ============================================================
export async function enregistrerLitige(dispute: Stripe.Dispute, compte: string) {
  const paymentIntentId = idPaymentIntent(dispute)
  if (!paymentIntentId) return
  const admin = createAdminClient()

  let paiement = await trouverPaiement(admin, paymentIntentId, compte)
  for (let tentative = 0; !paiement && tentative < 4; tentative++) {
    await new Promise(r => setTimeout(r, 3000))
    paiement = await trouverPaiement(admin, paymentIntentId, compte)
  }
  if (!paiement) throw new LitigeARejouer(`Commande introuvable pour le paiement ${paymentIntentId} (${compte}) — Stripe renverra l'événement`)

  const { commandeId, tranche } = paiement
  const { data: commande } = await admin.from('commandes').select('beatmaker_id, statut').eq('id', commandeId).single()
  if (!commande) return
  const vendeurId = (tranche?.vendeur_id as string | null) ?? commande.beatmaker_id

  const donnees = {
    commande_id: commandeId,
    beatmaker_id: vendeurId,
    tranche_id: tranche?.id ?? null,
    stripe_account_id: compte,
    stripe_dispute_id: dispute.id,
    montant: dispute.amount / 100,
    motif: dispute.reason ?? null,
    date_limite: dateLimite(dispute),
    statut: 'en_cours',
    ouvert_le: new Date(dispute.created * 1000).toISOString(),
  }
  const { data: cree } = await admin
    .from('litiges')
    .upsert(donnees, { onConflict: 'stripe_dispute_id', ignoreDuplicates: true })
    .select('id')
  // Ligne déjà là (event redélivré, ou créée par l'ancien code sans part) :
  // on complète sans toucher au statut ni à la réponse.
  if (!cree?.length) {
    await admin.from('litiges').update({
      beatmaker_id: vendeurId,
      tranche_id: donnees.tranche_id,
      stripe_account_id: compte,
      montant: donnees.montant,
      motif: donnees.motif,
      date_limite: donnees.date_limite,
    }).eq('stripe_dispute_id', dispute.id)
  }
  await appliquerReponseStripe(admin, dispute)

  if (STATUTS_REMBOURSABLES.has(commande.statut)) {
    await admin.from('commandes').update({ statut: 'litige' }).eq('id', commandeId).eq('statut', commande.statut)
  }

  if (cree?.length && tranche && !tranche.est_proprietaire && tranche.vendeur_id) {
    await envoyerLitigeCollaborateur({
      commandeId,
      vendeurId: tranche.vendeur_id,
      part: { vendeurNom: tranche.vendeur_nom, montant: donnees.montant, motif: donnees.motif, dateLimite: donnees.date_limite },
    }).catch(err => console.error('[litiges] Email collaborateur:', err))
  }

  // Un seul email à A pour toutes les parts arrivées en même temps : chaque
  // event réserve les litiges pas encore annoncés (le 2e trouve souvent tout
  // déjà réservé par le 1er et n'envoie rien).
  const { data: aAnnoncer } = await admin
    .from('litiges')
    .update({ alerte_envoyee_at: new Date().toISOString() })
    .eq('commande_id', commandeId)
    .eq('statut', 'en_cours')
    .is('alerte_envoyee_at', null)
    .select(SELECT_LITIGE)
  if (aAnnoncer?.length) {
    await envoyerLitigeOuvert({ commandeId, parts: await partsPourEmail(admin, aAnnoncer as LigneLitige[]) })
      .catch(err => console.error('[litiges] Email ouverture:', err))
  }
}

// Date limite et réponse déjà envoyée, lues sur l'objet Stripe.
async function appliquerReponseStripe(admin: Admin, dispute: Stripe.Dispute) {
  await admin.from('litiges').update({ date_limite: dateLimite(dispute) }).eq('stripe_dispute_id', dispute.id)
  const par = reponseDejaEnvoyee(dispute)
  if (!par) return
  await admin
    .from('litiges')
    .update({ reponse_par: par, reponse_envoyee_at: new Date().toISOString() })
    .eq('stripe_dispute_id', dispute.id)
    .is('reponse_par', null)
}

// charge.dispute.updated : surtout une réponse envoyée depuis Stripe par un
// vendeur. Litige encore inconnu (créé avant le lot 4b, ou event de création
// perdu) : on le rattrape ici.
export async function traiterLitigeMisAJour(dispute: Stripe.Dispute, compte: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('litiges').select('id, tranche_id, stripe_account_id').eq('stripe_dispute_id', dispute.id).maybeSingle()
  if (!data || !data.stripe_account_id) {
    await enregistrerLitige(dispute, compte)
    return
  }
  await appliquerReponseStripe(admin, dispute)
}

// ============================================================
// Clôture (charge.dispute.closed, ou acceptation par A)
// ============================================================
// Statuts de clôture : won / lost ; warning_closed = simple demande
// d'information de la banque, fermée sans argent repris (= comme gagné).
export async function cloreLitige(dispute: Stripe.Dispute, compte: string) {
  const perdu = dispute.status === 'lost'
  if (!perdu && dispute.status !== 'won' && dispute.status !== 'warning_closed') return
  const admin = createAdminClient()

  let { data: ligne } = await admin.from('litiges').select(SELECT_LITIGE).eq('stripe_dispute_id', dispute.id).maybeSingle()
  if (!ligne) {
    await enregistrerLitige(dispute, compte)
    ;({ data: ligne } = await admin.from('litiges').select(SELECT_LITIGE).eq('stripe_dispute_id', dispute.id).maybeSingle())
  }
  if (!ligne) return

  // Une seule clôture par litige (event redélivré, acceptation + webhook).
  const { data: clos } = await admin
    .from('litiges')
    .update({ statut: perdu ? 'perdu' : 'gagne', ferme_le: new Date().toISOString() })
    .eq('id', ligne.id)
    .eq('statut', 'en_cours')
    .select('id')
  if (!clos?.length) return
  const l = ligne as LigneLitige

  if (perdu) {
    const montantCents = dispute.amount
    const maintenant = new Date().toISOString()
    if (l.tranche_id) {
      const { data: t } = await admin.from('commande_tranches').select('montant_ttc_cents, montant_rembourse_cents').eq('id', l.tranche_id).single()
      if (t) {
        const rembourse = Math.min(t.montant_ttc_cents, t.montant_rembourse_cents + montantCents)
        await admin.from('commande_tranches').update({
          montant_rembourse_cents: rembourse,
          statut: rembourse >= t.montant_ttc_cents ? 'remboursee' : 'remboursee_partielle',
          rembourse_at: maintenant,
          rembourse_par: 'litige',
        }).eq('id', l.tranche_id)
      }
    } else {
      const { data: c } = await admin.from('commandes').select('prix_paye, montant_rembourse_cents').eq('id', l.commande_id).single()
      if (c) {
        const total = Math.round(Number(c.prix_paye) * 100)
        await admin.from('commandes').update({
          montant_rembourse_cents: Math.min(total, c.montant_rembourse_cents + montantCents),
          rembourse_at: maintenant,
        }).eq('id', l.commande_id)
      }
    }
    await emettreAvoir(admin, { commandeId: l.commande_id, trancheId: l.tranche_id, montantCents, motif: 'litige_perdu', sourceStripeId: dispute.id })
    await annulerLicence(admin, l.commande_id, 'litige_perdu')
  }

  await sortirDuLitige(admin, l.commande_id)
}

// Plus aucun litige en cours : la commande reprend le statut que donnent les
// sommes réellement rendues (payée, remboursée en partie, remboursée).
async function sortirDuLitige(admin: Admin, commandeId: string) {
  const { count } = await admin.from('litiges').select('id', { count: 'exact', head: true }).eq('commande_id', commandeId).eq('statut', 'en_cours')
  if (count) return
  await admin.from('commandes').update({ statut: 'payee' }).eq('id', commandeId).eq('statut', 'litige')
  await recalculerStatut(admin, commandeId)
}

// ============================================================
// Lecture pour la fiche commande (A et B)
// ============================================================
export type PartLitige = {
  id: string
  vendeurId: string
  vendeurNom: string
  estProprietaire: boolean
  montant: number
  statut: LigneLitige['statut']
  motif: string | null
  dateLimite: string | null
  reponsePar: LigneLitige['reponse_par']
  reponseEnvoyeeAt: string | null
  reponseErreur: string | null
  ouvertLe: string
  fermeLe: string | null
  reponsePossible: boolean
}

// Les litiges en cours sans réponse connue sont relus chez Stripe : une
// réponse de B depuis son espace Stripe se voit même si l'événement n'est
// pas (encore) arrivé.
export async function litigesDeLaCommande(admin: Admin, commandeId: string, proprietaireId: string): Promise<PartLitige[]> {
  const { data } = await admin.from('litiges').select(SELECT_LITIGE).eq('commande_id', commandeId).order('ouvert_le', { ascending: true })
  const lignes = (data ?? []) as LigneLitige[]
  if (!lignes.length) return []

  await Promise.all(lignes.filter(l => l.statut === 'en_cours' && !l.reponse_par && l.stripe_account_id).map(async l => {
    try {
      const d = await stripe.disputes.retrieve(l.stripe_dispute_id, {}, { stripeAccount: l.stripe_account_id! })
      const par = reponseDejaEnvoyee(d)
      l.date_limite = dateLimite(d) ?? l.date_limite
      if (par) {
        await appliquerReponseStripe(admin, d)
        l.reponse_par = par
        l.reponse_envoyee_at = new Date().toISOString()
      }
    } catch (err) {
      console.error('[litiges] Lecture Stripe impossible pour', l.stripe_dispute_id, err instanceof Error ? err.message : err)
    }
  }))

  const noms = await nomsVendeurs(admin, lignes)
  return lignes.map(l => ({
    id: l.id,
    vendeurId: l.beatmaker_id,
    vendeurNom: noms.get(l.beatmaker_id) ?? '',
    estProprietaire: l.beatmaker_id === proprietaireId,
    montant: Number(l.montant),
    statut: l.statut,
    motif: l.motif,
    dateLimite: l.date_limite,
    reponsePar: l.reponse_par,
    reponseEnvoyeeAt: l.reponse_envoyee_at,
    reponseErreur: l.reponse_erreur,
    ouvertLe: l.ouvert_le,
    fermeLe: l.ferme_le,
    reponsePossible: l.statut === 'en_cours' && !l.reponse_par && !!l.stripe_account_id,
  }))
}

// ============================================================
// Réponse de A (preuves automatiques + texte + fichier)
// ============================================================
export type FichierReponse = { nom: string; type: string; donnees: Buffer }

export type ResultatLitige = {
  ok: boolean
  erreur?: string
  envoyees: string[]
  ignorees: { vendeurNom: string; raison: string }[]
  echecs: { vendeurNom: string; erreur: string }[]
}

async function televerserPreuve(compte: string, nom: string, type: string, donnees: Buffer): Promise<string> {
  const f = await stripe.files.create(
    { purpose: 'dispute_evidence', file: { data: donnees, name: nom, type } },
    { stripeAccount: compte },
  )
  return f.id
}

async function fusionnerPdf(contenus: Buffer[]): Promise<Buffer> {
  if (contenus.length === 1) return contenus[0]
  const doc = await PDFDocument.create()
  for (const c of contenus) {
    const source = await PDFDocument.load(c)
    const pages = await doc.copyPages(source, source.getPageIndices())
    pages.forEach(p => doc.addPage(p))
  }
  return Buffer.from(await doc.save())
}

// Tout ce qui ne dépend pas du compte : coordonnées, description, contrats,
// historique de téléchargement. Les adresses IP ne sont transmises que sur
// le compte du propriétaire (un collaborateur ne voit jamais l'IP du client,
// et il peut lire la réponse envoyée sur son compte Stripe).
async function preparerPreuvesCommande(admin: Admin, commandeId: string) {
  const { data: commande } = await admin
    .from('commandes')
    .select('id, created_at, beatmaker_id, acheteur_email, acheteur_nom, acheteur_adresse, facture_pdf_url, clients(email, prenom, nom)')
    .eq('id', commandeId)
    .single()
  if (!commande) throw new Error('Commande introuvable')
  const client = commande.clients as unknown as { email: string | null; prenom: string | null; nom: string | null } | null

  const [{ data: boutique }, { data: lignes }, { data: telechargements }] = await Promise.all([
    admin.from('beatmakers').select('nom_artiste, slug, fuseau_horaire').eq('id', commande.beatmaker_id).single(),
    admin.from('commande_lignes').select('licence_nom, contrat_pdf_url, beats(titre)').eq('commande_id', commandeId),
    admin.from('licence_downloads').select('fichier, downloaded_at, ip_address').eq('commande_id', commandeId).order('downloaded_at', { ascending: true }),
  ])
  const tz = fuseauSur(boutique?.fuseau_horaire)
  type Ligne = { licence_nom: string | null; contrat_pdf_url: string | null; beats: { titre: string } | null }
  const articles = ((lignes ?? []) as unknown as Ligne[])
  const dateAchat = formatDateTimeTz(commande.created_at, tz, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const description = [
    `Achat sur la boutique en ligne « ${boutique?.nom_artiste ?? ''} » (plateforme My Producer) le ${dateAchat}.`,
    `Produit numérique : licence d'exploitation d'instrumental(s) musical(aux), livrée immédiatement après le paiement par un lien de téléchargement personnel :`,
    ...articles.map(a => `- ${a.beats?.titre ?? 'Beat'} — Licence ${a.licence_nom ?? ''}`.trim()),
    `Pièces jointes : contrat de licence au nom de l'acheteur, facture, historique de téléchargement des fichiers (journal de la plateforme).`,
  ].join('\n')

  type Dl = { fichier: string; downloaded_at: string; ip_address: string | null }
  const dls = (telechargements ?? []) as Dl[]
  const journal = (avecIp: boolean) => dls.length
    ? [
        'Historique de téléchargement des fichiers achetés (journal de la plateforme My Producer) :',
        ...dls.map(d => `- ${formatDateTimeTz(d.downloaded_at, tz, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — ${d.fichier === 'email_renvoi' ? 'lien de téléchargement renvoyé par email' : d.fichier}${avecIp && d.ip_address ? ` — IP ${d.ip_address}` : ''}`),
      ].join('\n')
    : "Aucun téléchargement enregistré à ce jour : le lien de téléchargement a été remis à l'acheteur juste après le paiement."

  const contrats: Buffer[] = []
  for (const a of articles) {
    if (!a.contrat_pdf_url) continue
    try { contrats.push(await lirePdfR2(a.contrat_pdf_url)) } catch (err) {
      console.error('[litiges] Contrat illisible', a.contrat_pdf_url, err instanceof Error ? err.message : err)
    }
  }

  return {
    proprietaireId: commande.beatmaker_id as string,
    email: commande.acheteur_email ?? client?.email ?? null,
    nom: commande.acheteur_nom ?? ([client?.prenom, client?.nom].filter(Boolean).join(' ') || null),
    adresse: commande.acheteur_adresse ?? null,
    dateService: formatDateTz(commande.created_at, tz, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    description,
    journal,
    contrat: contrats.length ? await fusionnerPdf(contrats) : null,
    factureSolo: commande.facture_pdf_url as string | null,
  }
}

async function litigesARepondre(admin: Admin, commandeId: string) {
  const { data } = await admin.from('litiges').select(SELECT_LITIGE).eq('commande_id', commandeId).eq('statut', 'en_cours').is('reponse_par', null)
  const lignes = (data ?? []) as LigneLitige[]
  return { lignes, noms: await nomsVendeurs(admin, lignes) }
}

// Relit le litige chez Stripe juste avant d'agir : réponse déjà envoyée (par
// B depuis Stripe) ou litige plus ouvert aux réponses → cette part est sautée.
async function verifierAvantAction(admin: Admin, l: LigneLitige): Promise<{ dispute: Stripe.Dispute | null; raison: string | null }> {
  const d = await stripe.disputes.retrieve(l.stripe_dispute_id, {}, { stripeAccount: l.stripe_account_id! })
  const par = reponseDejaEnvoyee(d)
  if (par) {
    await appliquerReponseStripe(admin, d)
    return { dispute: null, raison: par === 'vendeur_stripe' ? 'a déjà répondu directement depuis Stripe' : 'réponse déjà envoyée' }
  }
  if (!STATUTS_REPONSE_POSSIBLE.has(d.status)) return { dispute: null, raison: 'ce litige n\'accepte plus de réponse' }
  return { dispute: d, raison: null }
}

export async function envoyerReponseLitige(admin: Admin, commandeId: string, p: { texte: string; fichier: FichierReponse | null }): Promise<ResultatLitige> {
  const resultat: ResultatLitige = { ok: false, envoyees: [], ignorees: [], echecs: [] }
  if (!(await prendreVerrou(admin, commandeId))) return { ...resultat, erreur: 'Une action est déjà en cours sur cette commande.' }
  try {
    const { lignes, noms } = await litigesARepondre(admin, commandeId)
    if (!lignes.length) return { ...resultat, erreur: 'Aucun litige en attente de réponse sur cette commande.' }
    const preuves = await preparerPreuvesCommande(admin, commandeId)

    for (const l of lignes) {
      const vendeurNom = noms.get(l.beatmaker_id) ?? ''
      if (!l.stripe_account_id) { resultat.ignorees.push({ vendeurNom, raison: 'compte Stripe inconnu' }); continue }
      try {
        const { dispute, raison } = await verifierAvantAction(admin, l)
        if (!dispute) { resultat.ignorees.push({ vendeurNom, raison: raison ?? '' }); continue }

        let factureUrl = preuves.factureSolo
        if (l.tranche_id) {
          const { data: t } = await admin.from('commande_tranches').select('facture_pdf_url').eq('id', l.tranche_id).single()
          factureUrl = t?.facture_pdf_url ?? null
        }
        const compte = l.stripe_account_id
        const evidence: Stripe.DisputeUpdateParams.Evidence = {
          product_description: preuves.description,
          access_activity_log: preuves.journal(l.beatmaker_id === preuves.proprietaireId),
          service_date: preuves.dateService,
          ...(preuves.email ? { customer_email_address: preuves.email } : {}),
          ...(preuves.nom ? { customer_name: preuves.nom } : {}),
          ...(preuves.adresse ? { billing_address: preuves.adresse } : {}),
          ...(p.texte.trim() ? { uncategorized_text: p.texte.trim() } : {}),
        }
        if (factureUrl) evidence.receipt = await televerserPreuve(compte, 'facture.pdf', 'application/pdf', await lirePdfR2(factureUrl))
        if (preuves.contrat) evidence.service_documentation = await televerserPreuve(compte, 'contrat-de-licence.pdf', 'application/pdf', preuves.contrat)
        if (p.fichier) evidence.uncategorized_file = await televerserPreuve(compte, p.fichier.nom, p.fichier.type, p.fichier.donnees)

        await stripe.disputes.update(
          l.stripe_dispute_id,
          { evidence, metadata: { origine: ORIGINE_REMBOURSEMENT }, submit: true },
          { stripeAccount: compte },
        )
        await admin.from('litiges').update({
          reponse_par: 'proprietaire',
          reponse_envoyee_at: new Date().toISOString(),
          reponse_texte: p.texte.trim() || null,
          reponse_fichier_nom: p.fichier?.nom ?? null,
          reponse_erreur: null,
        }).eq('id', l.id)
        resultat.envoyees.push(vendeurNom)
      } catch (err) {
        const erreur = err instanceof Error ? err.message : 'Erreur Stripe inconnue'
        console.error('[litiges] Réponse impossible pour', l.stripe_dispute_id, erreur)
        await admin.from('litiges').update({ reponse_erreur: erreur }).eq('id', l.id)
        resultat.echecs.push({ vendeurNom, erreur })
      }
    }
    resultat.ok = resultat.echecs.length === 0 && resultat.envoyees.length > 0
    return resultat
  } finally {
    await rendreVerrou(admin, commandeId)
  }
}

// « Accepter le litige » = le perdre volontairement, pour toutes les parts
// encore sans réponse. Les conséquences (part reprise, avoir, licence
// annulée) sont appliquées tout de suite, sans attendre le webhook.
export async function accepterLitige(admin: Admin, commandeId: string): Promise<ResultatLitige> {
  const resultat: ResultatLitige = { ok: false, envoyees: [], ignorees: [], echecs: [] }
  if (!(await prendreVerrou(admin, commandeId))) return { ...resultat, erreur: 'Une action est déjà en cours sur cette commande.' }
  try {
    const { lignes, noms } = await litigesARepondre(admin, commandeId)
    if (!lignes.length) return { ...resultat, erreur: 'Aucun litige en attente de réponse sur cette commande.' }
    for (const l of lignes) {
      const vendeurNom = noms.get(l.beatmaker_id) ?? ''
      if (!l.stripe_account_id) { resultat.ignorees.push({ vendeurNom, raison: 'compte Stripe inconnu' }); continue }
      try {
        const { dispute, raison } = await verifierAvantAction(admin, l)
        if (!dispute) { resultat.ignorees.push({ vendeurNom, raison: raison ?? '' }); continue }
        const ferme = await stripe.disputes.close(l.stripe_dispute_id, {}, { stripeAccount: l.stripe_account_id })
        await admin.from('litiges').update({ reponse_par: 'acceptation', reponse_envoyee_at: new Date().toISOString(), reponse_erreur: null }).eq('id', l.id)
        await cloreLitige(ferme, l.stripe_account_id)
        resultat.envoyees.push(vendeurNom)
      } catch (err) {
        const erreur = err instanceof Error ? err.message : 'Erreur Stripe inconnue'
        console.error('[litiges] Acceptation impossible pour', l.stripe_dispute_id, erreur)
        await admin.from('litiges').update({ reponse_erreur: erreur }).eq('id', l.id)
        resultat.echecs.push({ vendeurNom, erreur })
      }
    }
    resultat.ok = resultat.echecs.length === 0 && resultat.envoyees.length > 0
    return resultat
  } finally {
    await rendreVerrou(admin, commandeId)
  }
}

// ============================================================
// Rappel 3 jours avant la date limite (cron quotidien)
// ============================================================
export async function envoyerRappelsLitiges(): Promise<number> {
  const admin = createAdminClient()
  const maintenant = new Date()
  const dansTroisJours = new Date(maintenant.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('litiges')
    .select('commande_id')
    .eq('statut', 'en_cours')
    .is('reponse_par', null)
    .is('rappel_envoye_at', null)
    .lte('date_limite', dansTroisJours)
    .gt('date_limite', maintenant.toISOString())
  const commandes = [...new Set((data ?? []).map(l => l.commande_id as string))]

  let envoyes = 0
  for (const commandeId of commandes) {
    const { data: reserves } = await admin
      .from('litiges')
      .update({ rappel_envoye_at: new Date().toISOString() })
      .eq('commande_id', commandeId)
      .eq('statut', 'en_cours')
      .is('reponse_par', null)
      .is('rappel_envoye_at', null)
      .lte('date_limite', dansTroisJours)
      .select(SELECT_LITIGE)
    if (!reserves?.length) continue
    await envoyerLitigeRappel({ commandeId, parts: await partsPourEmail(admin, reserves as LigneLitige[]) })
      .catch(err => console.error('[litiges] Email rappel:', err))
    envoyes++
  }
  return envoyes
}
