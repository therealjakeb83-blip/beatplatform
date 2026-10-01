import type Stripe from 'stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'
import { genererContratPdfPourVente } from '@/lib/contrat'
import { genererFacturePdfPourCommande, genererFacturePdfPourTranche } from '@/lib/facture'
import { uploadPdfContrat, uploadPdfFacture, uploadPdfFactureTranche } from '@/lib/livraison'
import { terminerAvoir } from '@/lib/avoirs'
import { calculerStatutLivraison, type StatutLivraison } from '@/lib/livraison-statut'
import { alerteCommandeIncomplete } from '@/lib/emails'

type Admin = ReturnType<typeof createAdminClient>

export type TrancheFrais = { id: string; stripe_account_id: string | null; stripe_payment_intent_id: string | null; montant_ttc_cents: number }

// Frais Stripe réels de chaque part encaissée (lus sur le compte du vendeur).
export async function remplirFraisTranches(supabase: Admin, tranches: TrancheFrais[]) {
  for (const t of tranches) {
    if (!t.stripe_payment_intent_id || !t.stripe_account_id) continue
    try {
      const pi = await stripe.paymentIntents.retrieve(
        t.stripe_payment_intent_id,
        { expand: ['latest_charge.balance_transaction'] },
        { stripeAccount: t.stripe_account_id },
      )
      const charge = pi.latest_charge as Stripe.Charge | null
      const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null
      if (!bt || typeof bt === 'string') continue
      await supabase.from('commande_tranches').update({ frais_stripe_cents: bt.fee, net_cents: t.montant_ttc_cents - bt.fee }).eq('id', t.id)
    } catch (err) {
      console.error('[completion] Frais Stripe de la tranche', t.id, 'non récupérés :', err)
    }
  }
}

export type ResultatCompletion = { statut: StatutLivraison; repares: number; echecs: string[] }

// Complète une commande (Phase 13 lot 5, décision de Jake : « s'il manque
// une chose, ça revient tout seul jusqu'à ce que ce soit bon »). Ne refait
// QUE ce qui manque, avec les données figées à la vente : jamais un nouveau
// numéro de facture (le PDF reprend le numéro déjà attribué), jamais
// d'argent déplacé. Sans risque à relancer autant de fois que nécessaire.
// Appelée : 2e essai juste après la vente, tâche de nuit, bouton « Réessayer ».
export async function completerCommande(commandeId: string): Promise<ResultatCompletion> {
  const admin = createAdminClient()
  const { problemes } = await calculerStatutLivraison(commandeId)
  let repares = 0
  const echecs: string[] = []

  if (problemes.some(p => p.type === 'contrat_manquant')) {
    const r = await refaireContrats(admin, commandeId)
    repares += r.repares
    echecs.push(...r.echecs)
  }

  for (const p of problemes) {
    try {
      if (p.type === 'facture_manquante' && p.trancheId === null) {
        const pdf = await genererFacturePdfPourCommande(admin, commandeId)
        const url = await uploadPdfFacture(commandeId, pdf)
        await admin.from('commandes').update({ facture_pdf_url: url }).eq('id', commandeId)
        repares++
      } else if (p.type === 'facture_manquante' && p.trancheId) {
        const pdf = await genererFacturePdfPourTranche(admin, p.trancheId)
        const url = await uploadPdfFactureTranche(commandeId, p.trancheId, pdf)
        await admin.from('commande_tranches').update({ facture_pdf_url: url }).eq('id', p.trancheId)
        repares++
      } else if (p.type === 'avoir_incomplet') {
        if (await terminerAvoir(admin, p.avoirId)) repares++
        else echecs.push(`Avoir ${p.numero.startsWith('reserve-') ? 'sans numéro' : p.numero} toujours incomplet`)
      } else if (p.type === 'lignes_manquantes') {
        echecs.push('Articles de la commande absents (vente interrompue) — réparation automatique impossible')
      }
    } catch (err) {
      const quoi = p.type === 'facture_manquante' ? `Facture${p.vendeurNom ? ` de ${p.vendeurNom}` : ''}` : 'Pièce'
      echecs.push(`${quoi} toujours en échec : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    }
  }

  const tranchesSansFrais = problemes.flatMap(p => p.type === 'frais_manquants' ? [p.trancheId] : [])
  if (tranchesSansFrais.length) {
    const { data: tranches } = await admin
      .from('commande_tranches')
      .select('id, stripe_account_id, stripe_payment_intent_id, montant_ttc_cents')
      .in('id', tranchesSansFrais)
    await remplirFraisTranches(admin, (tranches ?? []) as TrancheFrais[])
  }

  const apres = await calculerStatutLivraison(commandeId)
  const fraisRepares = tranchesSansFrais.length - apres.problemes.filter(p => p.type === 'frais_manquants').length
  repares += Math.max(fraisRepares, 0)
  if (apres.problemes.some(p => p.type === 'frais_manquants')) echecs.push('Frais Stripe d\'une part toujours introuvables')

  await admin.from('commandes').update({
    statut_livraison: apres.statut,
    fichiers_livres: !apres.problemes.some(p => p.type === 'contrat_manquant' || p.type === 'lignes_manquantes'),
    ...(apres.statut === 'livree' ? { completion_tentatives: 0, completion_alerte_at: null } : {}),
  }).eq('id', commandeId)

  return { statut: apres.statut, repares, echecs }
}

async function refaireContrats(admin: Admin, commandeId: string): Promise<{ repares: number; echecs: string[] }> {
  const echecs: string[] = []
  let repares = 0
  const { data: commande } = await admin
    .from('commandes')
    .select('id, created_at, acheteur_nom, acheteur_email, acheteur_adresse, beatmaker_id, beatmakers(nom_artiste)')
    .eq('id', commandeId)
    .single()
  if (!commande) return { repares, echecs: ['Commande introuvable'] }
  const beatmaker = commande.beatmakers as unknown as { nom_artiste: string } | null

  const { data: lignesManquantes } = await admin
    .from('commande_lignes')
    .select('id, beat_id, licence_id, licence_nom, splits_snapshot, prix_paye, beats(titre), licence_streams_limite, licence_ventes_physiques_limite, licence_vues_video_limite, licence_clips_video_limite, licence_radio_tv_limite, licence_lives_performances_autorise')
    .eq('commande_id', commandeId)
    .is('contrat_pdf_url', null)

  for (const ligne of (lignesManquantes ?? []) as unknown as {
    id: string
    beat_id: string | null
    licence_id: string | null
    splits_snapshot: { nom_artiste: string; pourcentage: number }[] | null
    prix_paye: number
    beats: { titre: string } | null
    licence_streams_limite: number | null
    licence_ventes_physiques_limite: number | null
    licence_vues_video_limite: number | null
    licence_clips_video_limite: number | null
    licence_radio_tv_limite: number | null
    licence_lives_performances_autorise: boolean | null
  }[]) {
    if (!ligne.beat_id || !ligne.licence_id) {
      echecs.push(`Contrat impossible à générer pour la ligne ${ligne.id} (données manquantes)`)
      continue
    }
    try {
      const pdfBytes = await genererContratPdfPourVente(admin, {
        beatId: ligne.beat_id,
        licenceId: ligne.licence_id,
        beatmakerId: commande.beatmaker_id,
        acheteurNom: commande.acheteur_nom,
        acheteurEmail: commande.acheteur_email,
        acheteurAdresse: commande.acheteur_adresse,
        prixPaye: Number(ligne.prix_paye),
        splits: ligne.splits_snapshot ?? [{ nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker', pourcentage: 100 }],
        dateVente: new Date(commande.created_at),
        limitesSnapshot: {
          streams_limite: ligne.licence_streams_limite,
          ventes_physiques_limite: ligne.licence_ventes_physiques_limite,
          vues_video_limite: ligne.licence_vues_video_limite,
          clips_video_limite: ligne.licence_clips_video_limite,
          radio_tv_limite: ligne.licence_radio_tv_limite,
          lives_performances_autorise: ligne.licence_lives_performances_autorise,
        },
      })
      const pdfUrl = await uploadPdfContrat(ligne.id, pdfBytes)
      await admin.from('commande_lignes').update({ contrat_pdf_url: pdfUrl }).eq('id', ligne.id)
      repares++
    } catch (err) {
      echecs.push(`Contrat de « ${ligne.beats?.titre ?? ligne.id} » toujours en échec : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    }
  }
  return { repares, echecs }
}

const PAR_PASSAGE = 20
const NUITS_AVANT_ALERTE = 3
const HEURE_MS = 60 * 60 * 1000

// Tâche de nuit : ne relit que la « pile à réparer » (index partiel
// commandes_a_completer_idx, jamais les commandes saines). Une commande
// restée « en cours » (vente interrompue) n'y entre qu'entre 1 h et 7 jours
// d'âge — au-delà ce sont de vieilles données d'avant la Phase 5 ; une fois
// passée en « problème » elle est reprise chaque nuit jusqu'à être complète.
export async function completerCommandesEnAttente(): Promise<{ examinees: number; completees: number; alertes: number }> {
  const admin = createAdminClient()
  const maintenant = Date.now()
  const ilYAUneHeure = new Date(maintenant - HEURE_MS).toISOString()
  const ilYASeptJours = new Date(maintenant - 7 * 24 * HEURE_MS).toISOString()

  const { data: commandes, error } = await admin
    .from('commandes')
    .select('id, beatmaker_id, completion_tentatives, completion_alerte_at')
    .neq('statut_livraison', 'livree')
    .or(`statut_livraison.eq.probleme,and(statut_livraison.eq.en_cours,created_at.lt."${ilYAUneHeure}",created_at.gt."${ilYASeptJours}")`)
    .order('completion_derniere_tentative_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(PAR_PASSAGE)
  if (error) {
    console.error('[completion] Lecture de la pile impossible :', JSON.stringify(error))
    return { examinees: 0, completees: 0, alertes: 0 }
  }

  let completees = 0
  let alertes = 0
  for (const c of commandes ?? []) {
    let statut: StatutLivraison = 'probleme'
    try {
      statut = (await completerCommande(c.id)).statut
    } catch (err) {
      console.error('[completion] Échec sur la commande', c.id, ':', err)
    }
    if (statut === 'livree') {
      completees++
      await admin.from('commandes').update({ completion_derniere_tentative_at: new Date().toISOString() }).eq('id', c.id)
      continue
    }
    const tentatives = (c.completion_tentatives ?? 0) + 1
    const alerter = tentatives >= NUITS_AVANT_ALERTE && !c.completion_alerte_at
    await admin.from('commandes').update({
      completion_tentatives: tentatives,
      completion_derniere_tentative_at: new Date().toISOString(),
      ...(alerter ? { completion_alerte_at: new Date().toISOString() } : {}),
    }).eq('id', c.id)
    if (alerter) {
      await envoyerAlertes(admin, c.id, c.beatmaker_id)
      alertes++
    }
  }
  return { examinees: (commandes ?? []).length, completees, alertes }
}

async function envoyerAlertes(admin: Admin, commandeId: string, beatmakerId: string) {
  const [{ data: vendeur }, { data: admins }] = await Promise.all([
    admin.from('beatmakers').select('id, email').eq('id', beatmakerId).single(),
    admin.from('beatmakers').select('id, email').eq('role', 'admin'),
  ])
  const vendeurEstAdmin = (admins ?? []).some(a => a.id === vendeur?.id)
  if (vendeur?.email && !vendeurEstAdmin) {
    await alerteCommandeIncomplete({ to: vendeur.email, beatmakerId: vendeur.id, commandeId, pourAdmin: false })
      .catch(err => console.error('[completion] Alerte vendeur non envoyée :', err))
  }
  for (const a of admins ?? []) {
    if (!a.email) continue
    await alerteCommandeIncomplete({ to: a.email, beatmakerId: a.id, commandeId, pourAdmin: true })
      .catch(err => console.error('[completion] Alerte admin non envoyée :', err))
  }
}
