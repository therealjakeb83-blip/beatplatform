import type Stripe from 'stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmationAbonnement, envoyerNouvelAbonnement, confirmationDemandeAnnulation, annulationAbonnement } from '@/lib/emails'
import { automatisationActive } from '@/lib/automatisations'
import { formaterAdresse, resoudreOuCreerClient } from '@/lib/webhook-paiement'
import { genererNumeroFacture, modeleFactureEffectif } from '@/lib/facturation'
import { genererFacturePdfPourCommande } from '@/lib/facture'
import { uploadPdfFacture } from '@/lib/livraison'
import { fuseauSur } from '@/lib/fuseau-horaire'
import { calculerStatutLivraison } from '@/lib/livraison-statut'
import { completerCommande } from '@/lib/completion-commande'

// Abonnements boutique (artiste → beatmaker) : traitement des événements
// Stripe, partagé entre le webhook plateforme (anciens abonnements créés sur
// la plateforme, avant le paiement direct) et le webhook des comptes vendeurs
// (abonnements en paiement direct, lot 1 du 2026-10-01).

// Erreur pour laquelle le webhook répond 500 : Stripe renvoie alors
// l'événement plus tard (abonnement payé qu'on n'a pas encore pu enregistrer —
// bug du 2026-09-28, 3 abonnements perdus sans bruit avant ce filet).
export class EvenementARejouer extends Error {}

type Supabase = ReturnType<typeof createAdminClient>

export async function traiterMajAbonnementBoutique(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()
  const status = subscription.status
  // actif = active ou trialing ; impaye = renouvellement en échec mais Stripe
  // retente encore (past_due) ; annule = tout le reste (canceled, unpaid...)
  const statut = (status === 'active' || status === 'trialing') ? 'actif'
    : status === 'past_due' ? 'impaye'
    : 'annule'
  const enEssai = status === 'trialing'

  const { data: abo } = await supabase
    .from('abonnements_boutique')
    .select('id, beatmaker_id, client_id, statut, acheteur_email, demande_annulation_notifiee')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (!abo) return

  // Boutique suspendue depuis l'admin (Étape 15c) — pause_collection ne
  // change PAS subscription.status (reste "active"), donc sans ce garde-fou
  // ce handler écraserait silencieusement 'suspendu' par 'actif' au premier
  // événement Stripe reçu sur l'abonnement (y compris celui déclenché par la
  // pause elle-même), cassant la réactivation qui ne retrouve alors plus
  // rien à traiter. Découvert en testant le 2026-07-24. Le statut ne doit
  // être repris que par reactiverBoutique() (lib/admin-boutiques.ts).
  if (abo.statut === 'suspendu') return

  const entreEnImpaye = statut === 'impaye' && abo.statut !== 'impaye'
  // Moment de la décision de churn (clic "Annuler" côté Business ou
  // self-service client) — l'abo reste actif jusqu'à la fin de la période
  // payée (cancel_at_period_end), Stripe n'enverra subscription.deleted que
  // plus tard. Jake veut le message churn dès la décision, pas à l'échéance
  // réelle (voir traiterAnnulationAbonnement pour le filet des annulations
  // immédiates, ex. abo impaye annulé sans phase de transition).
  //
  // Pas de détection de transition ici (ex. "!abo.annulation_en_cours") : le
  // bouton Business pose annulation_en_cours=true en base de façon synchrone
  // dans sa propre route, avant même que ce webhook n'arrive — une détection
  // par transition ne verrait donc jamais passer ce cas (toujours déjà true à
  // la lecture). On tente l'insertion à chaque webhook où cancel_at_period_end
  // est true ; la contrainte UNIQUE(type, reference_id) sur
  // automatisation_evenements absorbe les tentatives redondantes (même
  // mécanisme que pour abonnement_en_attente).
  const demandeAnnulationProgrammee = subscription.cancel_at_period_end === true

  // Contrairement au churn (ci-dessus), demande_annulation_notifiee n'est
  // écrit QUE par ce webhook — pas de race avec une route synchrone — donc
  // une vraie détection de transition est possible et nécessaire ici (sinon
  // Stripe redéliverait cet email à chaque nouvel événement "updated" reçu
  // tant que l'abo reste en cancel_at_period_end, ex. tout autre changement
  // sur l'abonnement pendant cette période).
  const notifierDemandeAnnulation = demandeAnnulationProgrammee && !abo.demande_annulation_notifiee

  const { error } = await supabase
    .from('abonnements_boutique')
    .update({
      statut,
      en_essai: enEssai,
      // Synchronise le flag même pour l'annulation self-service côté client
      // (/api/stripe/abonnement/annuler), qui ne le mettait jusqu'ici jamais à
      // jour en base — seul le bouton Business le faisait.
      annulation_en_cours: subscription.cancel_at_period_end,
      // Reset dès que l'abo n'est plus en cancel_at_period_end (annulation
      // annulée ou déjà passée) — une future demande d'annulation renverra
      // à nouveau l'email de confirmation.
      demande_annulation_notifiee: demandeAnnulationProgrammee,
      // Ne pose la date que la première fois (pas à chaque relance Stripe tant
      // qu'on reste en impaye) ; la efface si le paiement est finalement repassé.
      ...(entreEnImpaye ? { impaye_depuis: new Date().toISOString() } : {}),
      ...(statut === 'actif' ? { impaye_depuis: null } : {}),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur maj abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement mis à jour:', subscription.id, statut)

  if (entreEnImpaye && abo.client_id && await automatisationActive(abo.beatmaker_id, 'abonnement_en_attente')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: abo.beatmaker_id,
      client_id: abo.client_id,
      type: 'abonnement_en_attente',
      reference_id: abo.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements (impaye):', JSON.stringify(evenementError))
  }

  if (demandeAnnulationProgrammee && abo.client_id && await automatisationActive(abo.beatmaker_id, 'churn_message_perso')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: abo.beatmaker_id,
      client_id: abo.client_id,
      type: 'churn_message_perso',
      reference_id: abo.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements (churn):', JSON.stringify(evenementError))
  }

  // cancel_at_period_end=true ne remplit PAS cancel_at (mécanismes séparés
  // côté Stripe, vérifié le 2026-07-17 — cancel_at sert uniquement à annuler
  // à un timestamp choisi explicitement). La vraie date de fin est
  // current_period_end, déplacé sur l'item dans cette version de l'API (même
  // restructuration que pour invoice.parent.subscription_details, voir
  // traiterPaiementAbonnement) — un seul item par abonnement dans ce modèle.
  const finPeriode = subscription.items.data[0]?.current_period_end
  if (notifierDemandeAnnulation && abo.acheteur_email && finPeriode) {
    // await : sinon la promesse (appel Resend + écriture email_logs) risque de
    // ne jamais finir — c'est la dernière instruction de la fonction, rien
    // après pour laisser le temps au fire-and-forget de compléter avant que
    // Vercel ne gèle l'instance à la réponse du webhook (bug constaté le
    // 2026-07-17 : conditions toutes vraies au diagnostic, mais aucun email
    // ni aucune erreur nulle part).
    await confirmationDemandeAnnulation({
      to: abo.acheteur_email,
      beatmakerId: abo.beatmaker_id,
      clientId: abo.client_id,
      dateFin: new Date(finPeriode * 1000),
    }).catch(err => console.error('[webhook] Erreur envoi email demande annulation:', err))
  }
}

export async function traiterAnnulationAbonnementBoutique(subscription: Stripe.Subscription) {
  const supabase = createAdminClient()

  const { data: abo } = await supabase
    .from('abonnements_boutique')
    .select('id, beatmaker_id, client_id, acheteur_email, demande_annulation_notifiee')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  const { error } = await supabase
    .from('abonnements_boutique')
    .update({ statut: 'annule', en_essai: false, mois_consecutifs: 0, impaye_depuis: null })
    .eq('stripe_subscription_id', subscription.id)

  if (error) console.error('[webhook] Erreur annulation abonnement:', JSON.stringify(error))
  else console.log('[webhook] Abonnement annulé:', subscription.id)

  // Filet réservé au cas où aucune demande_annulation_abonnement n'a été
  // envoyée avant (ex. abo impayé résilié directement, sans jamais passer
  // par cancel_at_period_end) — sinon le client recevrait 2 emails pour la
  // même annulation, la date étant déjà connue depuis la 1ère confirmation.
  if (abo?.acheteur_email && !abo.demande_annulation_notifiee) {
    await annulationAbonnement({
      to: abo.acheteur_email,
      beatmakerId: abo.beatmaker_id,
      clientId: abo.client_id,
    }).catch(err => console.error('[webhook] Erreur envoi email annulation abonnement:', err))
  }

  // Filet pour les annulations immédiates (ex. abo impaye annulé directement,
  // sans être passé par cancel_at_period_end) — le cas normal (décision
  // d'annuler pendant que l'abo est encore actif) est déjà couvert par
  // traiterMajAbonnement. La contrainte UNIQUE(type, reference_id) sur
  // automatisation_evenements empêche un double envoi si les deux se
  // déclenchent pour le même abo.
  if (abo?.client_id && await automatisationActive(abo.beatmaker_id, 'churn_message_perso')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: abo.beatmaker_id,
      client_id: abo.client_id,
      type: 'churn_message_perso',
      reference_id: abo.id,
    })
    if (evenementError) console.error('[webhook] Erreur insert automatisation_evenements (churn):', JSON.stringify(evenementError))
  }
}

export function abonnementDeLaFacture(invoice: Stripe.Invoice): string | null {
  const subRaw = invoice.parent?.subscription_details?.subscription
  return typeof subRaw === 'string' ? subRaw : subRaw?.id ?? null
}

export function estFactureAbonnement(invoice: Stripe.Invoice): boolean {
  const billing = invoice.billing_reason
  return billing === 'subscription_create' || billing === 'subscription_cycle' || billing === 'subscription_update'
}

export type AboPourPaiement = { id: string; client_id: string | null; beatmaker_id: string; tva_taux: number | null; source_marketing: string | null }

export type AcheteurCommande = {
  email?: string | null
  nom?: string | null
  adresse?: string | null
  telephone?: string | null
  raisonSociale?: string | null
  numeroTva?: string | null
  codePromo?: string | null
}

// Commande (création ou renouvellement) + facture + compteurs de fidélité
// pour une facture d'abonnement payée. Idempotent sur l'id de facture Stripe.
// Pas de facture pour un mois à 0 € (code promo 100 %) : aucune opération à
// facturer, même règle qu'une licence offerte.
export async function enregistrerPaiementAbonnement(supabase: Supabase, abo: AboPourPaiement, invoice: Stripe.Invoice, acheteur: AcheteurCommande = {}) {
  const typeCommande = invoice.billing_reason === 'subscription_create' ? 'CREATION_ABONNEMENT' : 'RENOUVELLEMENT'
  const montantCents = invoice.amount_paid ?? 0
  const prixPaye = montantCents / 100
  const invoiceId = invoice.id
  const remiseCents = (invoice.total_discount_amounts ?? []).reduce((s, d) => s + d.amount, 0)

  // Éviter les doublons si le webhook est rejoué (clé d'idempotence = invoice.id)
  const { data: existing } = await supabase
    .from('commandes')
    .select('id')
    .eq('plateforme_source', 'my_producer')
    .eq('external_order_id', invoiceId)
    .maybeSingle()
  if (existing) {
    console.log('[abonnement] Paiement abo déjà enregistré:', invoiceId)
    return
  }

  const { data: commandeAbo, error } = await supabase.from('commandes').insert({
    client_id: abo.client_id,
    beatmaker_id: abo.beatmaker_id,
    prix_paye: prixPaye,
    methode_paiement: 'stripe',
    statut: 'payee',
    plateforme_source: 'my_producer',
    external_order_id: invoiceId,
    type_commande: typeCommande,
    // Pas de contrat PDF / fichier pour une commande d'abonnement — toujours
    // "livrée" dès la création, aucune opération asynchrone à suivre ici.
    fichiers_livres: true,
    statut_livraison: 'livree',
    // Taux figé à la souscription (TVA toujours absorbée) — jamais le taux
    // actuel du beatmaker, qui a pu changer depuis pour d'autres abonnés.
    tva_taux: abo.tva_taux,
    source_marketing: abo.source_marketing ?? 'direct',
    acheteur_email: acheteur.email ?? null,
    acheteur_nom: acheteur.nom ?? null,
    acheteur_adresse: acheteur.adresse ?? null,
    acheteur_telephone: acheteur.telephone ?? null,
    acheteur_raison_sociale: acheteur.raisonSociale ?? null,
    acheteur_numero_tva: acheteur.numeroTva ?? null,
    code_promo: remiseCents > 0 ? (acheteur.codePromo ?? null) : null,
    reduction_montant: remiseCents / 100,
  }).select('id').single()

  if (error || !commandeAbo) {
    throw new EvenementARejouer(`Insert commande abonnement refusé (${invoiceId}) : ${JSON.stringify(error)}`)
  }

  // Facturation (Phase 8) — même règle que pour une vente de licence :
  // aucune facture générée tant que le mandat de facturation n'a pas été
  // accepté. Gap réel trouvé le 2026-09-09 : les commandes d'abonnement
  // passaient par ce chemin séparé, jamais par finaliserCommandePayee, donc
  // ne recevaient jamais de numero_facture/facture_pdf_url.
  const { data: beatmakerFacturation } = await supabase
    .from('beatmakers')
    .select('slug, mandat_facturation_version, facturation_format, fuseau_horaire, pays, facture_modele, facture_mentions')
    .eq('id', abo.beatmaker_id)
    .single()

  if (beatmakerFacturation?.mandat_facturation_version && montantCents > 0) {
    try {
      const numeroFacture = await genererNumeroFacture(supabase, {
        beatmakerId: abo.beatmaker_id,
        slug: beatmakerFacturation.slug,
        format: beatmakerFacturation.facturation_format ?? null,
        dateVente: new Date(),
        fuseauHoraire: fuseauSur(beatmakerFacturation.fuseau_horaire),
      })
      await supabase.from('commandes').update({
        numero_facture: numeroFacture,
        mandat_facturation_version: beatmakerFacturation.mandat_facturation_version,
        facture_modele: modeleFactureEffectif(beatmakerFacturation.facture_modele, beatmakerFacturation.pays),
        facture_mentions: beatmakerFacturation.facture_mentions ?? null,
      }).eq('id', commandeAbo.id)

      const pdfBytes = await genererFacturePdfPourCommande(supabase, commandeAbo.id)
      const pdfUrl = await uploadPdfFacture(commandeAbo.id, pdfBytes)
      await supabase.from('commandes').update({ facture_pdf_url: pdfUrl }).eq('id', commandeAbo.id)
    } catch (err) {
      console.error('[abonnement] Erreur génération facture pour commande abo:', err)
    }
    // Facture ratée : la commande passe « à compléter » (2e essai tout de
    // suite, puis la tâche de nuit) au lieu de rester « livrée » d'office.
    const { statut: statutLivraison } = await calculerStatutLivraison(commandeAbo.id)
    if (statutLivraison === 'probleme') {
      await supabase.from('commandes').update({ statut_livraison: 'probleme' }).eq('id', commandeAbo.id)
      await completerCommande(commandeAbo.id).catch(err => console.error('[abonnement] 2e essai de complétion en échec:', err))
    }
  }

  // Incrémenter mensualites_payees (total facturé) et mois_consecutifs (compteur
  // de fidélité vers le beat cadeau — remis à 0 uniquement sur annulation, pas
  // sur un simple impayé temporaire : un paiement qui repasse pendant la
  // période de grâce ne fait donc pas "repartir de zéro")
  const { data: aboActuel } = await supabase
    .from('abonnements_boutique')
    .select('mensualites_payees, mois_consecutifs')
    .eq('id', abo.id)
    .single()
  await supabase
    .from('abonnements_boutique')
    .update({
      mensualites_payees: (aboActuel?.mensualites_payees ?? 0) + 1,
      mois_consecutifs: (aboActuel?.mois_consecutifs ?? 0) + 1,
      impaye_depuis: null,
    })
    .eq('id', abo.id)

  console.log('[abonnement]', typeCommande, '— commande créée, mensualites_payees incrémenté pour abo', abo.id)
}

// Échec de renouvellement d'un abonnement boutique, tracé dans
// tentatives_paiement (une ligne par facture Stripe). Renvoie false si
// l'abonnement n'est pas un abonnement boutique connu.
export async function tracerEchecRenouvellementBoutique(supabase: Supabase, invoice: Stripe.Invoice, subscriptionId: string): Promise<boolean> {
  const { data: abo } = await supabase
    .from('abonnements_boutique')
    .select('id, beatmaker_id, client_id, acheteur_email, source_marketing')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (!abo) return false

  const { error } = await supabase.from('tentatives_paiement').upsert({
    type: 'renouvellement_abonnement',
    beatmaker_id: abo.beatmaker_id,
    abonnement_id: abo.id,
    client_id: abo.client_id,
    email: abo.acheteur_email,
    prix: (invoice.amount_due ?? 0) / 100,
    source_marketing: abo.source_marketing,
    stripe_invoice_id: invoice.id,
    statut: 'echouee',
  }, { onConflict: 'stripe_invoice_id' })

  if (error) console.error('[abonnement] Erreur insert tentative renouvellement:', JSON.stringify(error))
  else console.log('[abonnement] Échec de renouvellement tracé pour abo', abo.id)
  return true
}

// ============================================================
// Paiement direct (lot 1, 2026-10-01) — abonnements créés sur le compte
// Stripe du beatmaker par /api/stripe/abonnement/creer. Toutes les infos de
// l'acheteur voyagent dans les metadata de l'abonnement, recopiées par Stripe
// sur chacune de ses factures (parent.subscription_details.metadata).
// ============================================================

function acheteurDepuisMetadata(meta: Stripe.Metadata) {
  const email = meta.email ? meta.email.toLowerCase().trim() : null
  const nom = [meta.prenom, meta.nom].map(s => s?.trim()).filter(Boolean).join(' ') || null
  const adresseRaw: Stripe.Address | null = meta.adresse
    ? { line1: meta.adresse, line2: null, city: meta.ville || null, postal_code: meta.code_postal || null, country: meta.pays || null, state: null }
    : null
  return {
    email,
    nom,
    adresseRaw,
    adresse: formaterAdresse(adresseRaw),
    telephone: meta.telephone || null,
    raisonSociale: meta.acheteur_raison_sociale || null,
    numeroTva: meta.acheteur_numero_tva || null,
    codePromo: meta.code_promo || null,
  }
}

// Enregistre l'abonnement à la confirmation de son 1er paiement (ou de sa 1re
// facture à 0 €) : rien n'existe chez nous pour un abonnement jamais payé.
async function enregistrerAbonnementDirect(
  supabase: Supabase,
  invoice: Stripe.Invoice,
  subscriptionId: string,
  meta: Stripe.Metadata,
  stripeAccountId: string,
): Promise<AboPourPaiement> {
  const { data: existant } = await supabase
    .from('abonnements_boutique')
    .select('id, client_id, beatmaker_id, tva_taux, source_marketing')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (existant) return existant as AboPourPaiement

  const acheteur = acheteurDepuisMetadata(meta)
  const newsletterOptIn = meta.newsletter_opt_in === 'true'
  // Résolution par email comme pour une licence (fiche créée si besoin,
  // adresse complétée) ; le compte artiste connecté au paiement prime.
  const clientIdParEmail = await resoudreOuCreerClient(supabase, acheteur.email, acheteur.nom, acheteur.adresseRaw, acheteur.telephone, { newsletterOptIn })
  let clientId = meta.client_id || clientIdParEmail
  if (!clientId) throw new EvenementARejouer(`Client introuvable pour l'abonnement ${subscriptionId}`)

  const { data: beatmaker } = await supabase.from('beatmakers').select('tva_active, tva_taux').eq('id', meta.beatmaker_id).single()
  const prixCents = Number(meta.prix_cents) || 0
  const finPeriode = invoice.lines?.data?.[0]?.period?.end
  const ligne = {
    beatmaker_id: meta.beatmaker_id,
    acheteur_email: acheteur.email,
    acheteur_nom: acheteur.nom,
    plan: 'standard',
    periode: 'mensuel',
    prix: prixCents,
    // TVA toujours absorbée — taux figé pour cet abonné à la souscription.
    tva_taux: beatmaker?.tva_active && beatmaker?.tva_taux ? beatmaker.tva_taux : null,
    devise: 'EUR',
    statut: 'actif',
    methode_paiement: 'stripe',
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null,
    stripe_account_id: stripeAccountId,
    en_essai: false,
    essai_fin_le: null,
    date_debut: new Date().toISOString(),
    date_fin: finPeriode ? new Date(finPeriode * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    source_marketing: meta.source_marketing || 'direct',
  }

  let { data: abonnement, error } = await supabase.from('abonnements_boutique')
    .insert({ ...ligne, client_id: clientId }).select('id, client_id, beatmaker_id, tva_taux, source_marketing').single()
  // Fiche disparue entre-temps (fusion de comptes) : la fiche à jour par email.
  if (error?.code === '23503' && acheteur.email) {
    const parEmail = await resoudreOuCreerClient(supabase, acheteur.email, acheteur.nom)
    if (parEmail) {
      clientId = parEmail
      ;({ data: abonnement, error } = await supabase.from('abonnements_boutique')
        .insert({ ...ligne, client_id: clientId }).select('id, client_id, beatmaker_id, tva_taux, source_marketing').single())
    }
  }
  if (error || !abonnement) {
    throw new EvenementARejouer(`Insert abonnement_boutique refusé (${subscriptionId}) : ${JSON.stringify(error)}`)
  }
  console.log('[abonnement] Abonnement direct créé:', abonnement.id, 'sur', stripeAccountId)

  if (acheteur.email) {
    await confirmationAbonnement({ to: acheteur.email, beatmakerId: meta.beatmaker_id, abonnementId: abonnement.id, clientId })
      .catch(err => console.error('[abonnement] Erreur envoi email confirmation abonnement:', err))
  }
  await envoyerNouvelAbonnement({ beatmakerId: meta.beatmaker_id, periode: 'mensuel', prixCents })
    .catch(err => console.error('[abonnement] Erreur envoi email nouvel abonnement:', err))

  if (await automatisationActive(meta.beatmaker_id, 'bienvenue_abonnement')) {
    const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
      beatmaker_id: meta.beatmaker_id, client_id: clientId, type: 'bienvenue_abonnement', reference_id: abonnement.id,
    })
    if (evenementError) console.error('[abonnement] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
  }

  // Code promo : une place prise par abonnement souscrit, en une opération
  // atomique (jamais refusée : l'abonnement est déjà payé).
  if (acheteur.codePromo) {
    const { data: codePromo } = await supabase.from('codes_promo').select('id')
      .eq('beatmaker_id', meta.beatmaker_id).eq('code', acheteur.codePromo).maybeSingle()
    if (codePromo) {
      const { error: placeError } = await supabase.rpc('code_promo_prendre_place', { p_code_id: codePromo.id, p_forcer: true })
      if (placeError) console.error('[abonnement] Erreur compteur code promo:', JSON.stringify(placeError))
    }
  }

  // Lead + newsletter, comme après un achat de licence (opt-in seulement).
  const { data: lead } = await supabase.from('leads').select('id, newsletter_inscrit')
    .eq('client_id', clientId).eq('beatmaker_id', meta.beatmaker_id).maybeSingle()
  if (!lead) {
    const { error: leadError } = await supabase.from('leads').insert({
      client_id: clientId, beatmaker_id: meta.beatmaker_id, source: 'visite', newsletter_inscrit: newsletterOptIn,
    })
    if (leadError) console.error('[abonnement] Erreur insert lead:', JSON.stringify(leadError))
  } else if (newsletterOptIn && !lead.newsletter_inscrit) {
    await supabase.from('leads').update({ newsletter_inscrit: true }).eq('id', lead.id)
  }

  return abonnement as AboPourPaiement
}

// invoice.paid sur un compte vendeur : 1er paiement (création de
// l'abonnement) ou renouvellement. Ignore tout ce qui n'est pas un abonnement
// boutique créé par My Producer.
export async function traiterFacturePayeeCompteVendeur(invoice: Stripe.Invoice, stripeAccountId: string) {
  if (!estFactureAbonnement(invoice)) return
  const subscriptionId = abonnementDeLaFacture(invoice)
  const meta = invoice.parent?.subscription_details?.metadata
  if (!subscriptionId || meta?.type !== 'abonnement_boutique' || !meta.beatmaker_id) return

  const supabase = createAdminClient()
  const abo = await enregistrerAbonnementDirect(supabase, invoice, subscriptionId, meta, stripeAccountId)
  const acheteur = acheteurDepuisMetadata(meta)
  await enregistrerPaiementAbonnement(supabase, abo, invoice, {
    email: acheteur.email,
    nom: acheteur.nom,
    adresse: acheteur.adresse,
    telephone: acheteur.telephone,
    raisonSociale: acheteur.raisonSociale,
    numeroTva: acheteur.numeroTva,
    codePromo: acheteur.codePromo,
  })
}

export async function traiterEchecFactureCompteVendeur(invoice: Stripe.Invoice) {
  if (!estFactureAbonnement(invoice)) return
  const subscriptionId = abonnementDeLaFacture(invoice)
  if (!subscriptionId) return
  await tracerEchecRenouvellementBoutique(createAdminClient(), invoice, subscriptionId)
}
