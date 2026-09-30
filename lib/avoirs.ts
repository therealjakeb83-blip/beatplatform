import type { createAdminClient } from '@/utils/supabase/admin'
import { genererNumeroFacture } from './facturation'
import { genererAvoirPdf } from './facture'
import { uploadPdfAvoir } from './livraison'
import { fuseauSur } from './fuseau-horaire'

type Admin = ReturnType<typeof createAdminClient>

export type MotifAvoir = 'remboursement' | 'remboursement_vendeur' | 'litige_perdu'

// Facture d'avoir d'un vendeur (Phase 13, lot 4 — décisions Q3 du grill-me et
// L4-Q1) : une par argent rendu à un vendeur qui avait une facture. Sans
// facture (beat offert, part à 0 €, mandat non accepté) : aucun avoir.
//
// Numéro pris dans la MÊME suite que les factures du vendeur. Un numéro
// attribué ne doit jamais être perdu (trou dans la suite) : la ligne est
// d'abord réservée par sa source Stripe (unique — un remboursement ou un
// litige ne donne jamais deux avoirs, même si deux événements arrivent en
// même temps), le numéro n'est pris qu'une fois la réservation gagnée.
export async function emettreAvoir(admin: Admin, p: {
  commandeId: string
  trancheId: string | null
  montantCents: number
  motif: MotifAvoir
  sourceStripeId: string
}): Promise<string | null> {
  if (p.montantCents <= 0) return null

  let vendeurId: string
  let factureNumero: string | null
  let factureTotalCents: number
  const { data: commande } = await admin
    .from('commandes')
    .select('id, beatmaker_id, numero_facture, prix_paye, created_at')
    .eq('id', p.commandeId)
    .single()
  if (!commande) return null

  if (p.trancheId) {
    const { data: tranche } = await admin
      .from('commande_tranches')
      .select('vendeur_id, facture_numero, montant_ttc_cents')
      .eq('id', p.trancheId)
      .single()
    if (!tranche?.vendeur_id) return null
    vendeurId = tranche.vendeur_id
    factureNumero = tranche.facture_numero
    factureTotalCents = tranche.montant_ttc_cents
  } else {
    vendeurId = commande.beatmaker_id
    factureNumero = commande.numero_facture
    factureTotalCents = Math.round(Number(commande.prix_paye) * 100)
  }
  if (!factureNumero) return null

  const reservation = `reserve-${p.sourceStripeId}`
  const { data: ligne, error: errReserve } = await admin
    .from('avoirs')
    .insert({
      commande_id: p.commandeId,
      tranche_id: p.trancheId,
      vendeur_id: vendeurId,
      numero: reservation,
      facture_numero_annulee: factureNumero,
      facture_date: commande.created_at,
      montant_cents: p.montantCents,
      total: p.montantCents >= factureTotalCents,
      motif: p.motif,
      source_stripe_id: p.sourceStripeId,
    })
    .select('id')
    .single()
  // Déjà émis (ou en cours d'émission) pour ce remboursement : rien à refaire.
  if (errReserve || !ligne) return null

  const { data: vendeur } = await admin
    .from('beatmakers')
    .select('slug, facturation_format, fuseau_horaire')
    .eq('id', vendeurId)
    .single()
  try {
    const numero = await genererNumeroFacture(admin, {
      beatmakerId: vendeurId,
      slug: vendeur?.slug ?? '',
      format: vendeur?.facturation_format ?? null,
      dateVente: new Date(),
      fuseauHoraire: fuseauSur(vendeur?.fuseau_horaire),
    })
    await admin.from('avoirs').update({ numero }).eq('id', ligne.id)
  } catch (err) {
    console.error('[avoirs] Numéro d\'avoir impossible pour', ligne.id, ':', err)
    return ligne.id
  }

  try {
    const pdf = await genererAvoirPdf(admin, ligne.id)
    const url = await uploadPdfAvoir(p.commandeId, ligne.id, pdf)
    await admin.from('avoirs').update({ pdf_url: url }).eq('id', ligne.id)
  } catch (err) {
    // Le numéro est attribué : le PDF sera régénéré à la demande (page de
    // téléchargement) — jamais un nouveau numéro.
    console.error('[avoirs] PDF d\'avoir impossible pour', ligne.id, ':', err)
  }
  return ligne.id
}

// PDF manquant (échec ponctuel à l'émission) : régénéré avec le numéro déjà
// attribué, jamais un nouveau.
export async function urlPdfAvoir(admin: Admin, avoir: { id: string; commande_id: string; numero: string; pdf_url: string | null }): Promise<string | null> {
  if (avoir.pdf_url) return avoir.pdf_url
  if (avoir.numero.startsWith('reserve-')) return null
  try {
    const pdf = await genererAvoirPdf(admin, avoir.id)
    const url = await uploadPdfAvoir(avoir.commande_id, avoir.id, pdf)
    await admin.from('avoirs').update({ pdf_url: url }).eq('id', avoir.id)
    return url
  } catch (err) {
    console.error('[avoirs] Régénération PDF impossible pour', avoir.id, ':', err)
    return null
  }
}
