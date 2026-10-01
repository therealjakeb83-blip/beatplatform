import { createAdminClient } from '@/utils/supabase/admin'

export type StatutLivraison = 'en_cours' | 'livree' | 'probleme'

export type ProblemeLivraison =
  | { type: 'contrat_manquant'; commandeLigneId: string }
  | { type: 'facture_manquante'; trancheId: string | null; vendeurNom: string | null }
  | { type: 'frais_manquants'; trancheId: string; vendeurNom: string | null }
  | { type: 'avoir_incomplet'; avoirId: string; numero: string }
  | { type: 'lignes_manquantes' }

// Un avoir « reserve-… » tout juste créé est en cours d'émission (le numéro
// arrive dans la seconde) : ne pas le compter comme un problème, sinon la
// réparation pourrait lui attribuer un 2e numéro en parallèle.
export const DELAI_AVOIR_RESERVE_MS = 10 * 60 * 1000

// Ce qui doit exister pour qu'une commande soit complète (Phase 13 lot 5) :
// contrat de chaque ligne, facture PDF de chaque numéro attribué (commande
// solo/abonnement ou part de chaque vendeur), frais Stripe de chaque part
// encaissée, avoirs numérotés avec leur PDF. Tout est réparable par
// lib/completion-commande.ts sauf des lignes absentes (vente interrompue
// avant leur création).
export async function calculerStatutLivraison(
  commandeId: string
): Promise<{ statut: StatutLivraison; problemes: ProblemeLivraison[] }> {
  const supabase = createAdminClient()

  const [{ data: commande }, { data: lignes }, { data: tranches }, { data: avoirs }] = await Promise.all([
    supabase.from('commandes').select('type_commande, numero_facture, facture_pdf_url').eq('id', commandeId).single(),
    supabase.from('commande_lignes').select('id, contrat_pdf_url').eq('commande_id', commandeId),
    supabase.from('commande_tranches')
      .select('id, vendeur_nom, facture_numero, facture_pdf_url, frais_stripe_cents, stripe_payment_intent_id, stripe_account_id, montant_ttc_cents')
      .eq('commande_id', commandeId),
    supabase.from('avoirs').select('id, numero, pdf_url, created_at').eq('commande_id', commandeId),
  ])

  const problemes: ProblemeLivraison[] = []

  if (commande?.type_commande === 'LICENCE' && !(lignes ?? []).length) {
    problemes.push({ type: 'lignes_manquantes' })
  }

  for (const ligne of lignes ?? []) {
    if (!ligne.contrat_pdf_url) problemes.push({ type: 'contrat_manquant', commandeLigneId: ligne.id })
  }

  if (commande?.numero_facture && !commande.facture_pdf_url) {
    problemes.push({ type: 'facture_manquante', trancheId: null, vendeurNom: null })
  }

  for (const t of tranches ?? []) {
    if (t.facture_numero && !t.facture_pdf_url) {
      problemes.push({ type: 'facture_manquante', trancheId: t.id, vendeurNom: t.vendeur_nom })
    }
    if (t.montant_ttc_cents > 0 && t.stripe_payment_intent_id && t.stripe_account_id && t.frais_stripe_cents === null) {
      problemes.push({ type: 'frais_manquants', trancheId: t.id, vendeurNom: t.vendeur_nom })
    }
  }

  const limiteReserve = Date.now() - DELAI_AVOIR_RESERVE_MS
  for (const a of avoirs ?? []) {
    const reserve = a.numero.startsWith('reserve-')
    if (reserve && new Date(a.created_at).getTime() > limiteReserve) continue
    if (reserve || !a.pdf_url) problemes.push({ type: 'avoir_incomplet', avoirId: a.id, numero: a.numero })
  }

  return { statut: problemes.length > 0 ? 'probleme' : 'livree', problemes }
}
