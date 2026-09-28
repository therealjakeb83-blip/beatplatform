import { stripe } from '@/lib/stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

// Abstraction « payment_readiness » (Phase 12, lot 4) : le reste du code
// demande seulement « ce vendeur peut-il encaisser ? », sans savoir quel
// fournisseur de paiement est derrière. Aujourd'hui uniquement Stripe
// Connect ; un autre fournisseur (PayPal en V2) s'ajouterait ici sans
// toucher à la checklist « prêt à vendre » ni au feu vert collab.

export type FournisseurPaiement = 'stripe'

export type EtatPaiementVendeur = {
  fournisseur: FournisseurPaiement
  compteConnecte: boolean
  operationnel: boolean
}

type CompteStocke = {
  stripe_account_id: string | null
  stripe_compte_operationnel: boolean | null
}

/**
 * Lit l'état réel du compte de paiement d'un vendeur. Le drapeau stocké
 * (tenu à jour par le webhook account.updated) sert de chemin rapide ; s'il
 * vaut encore false, une revérification directe auprès de Stripe rattrape un
 * event manqué (comportement repris tel quel du lot 2).
 */
export async function lireEtatPaiementVendeur(
  admin: SupabaseClient,
  beatmakerId: string,
  compte?: CompteStocke,
): Promise<EtatPaiementVendeur> {
  let stocke = compte
  if (!stocke) {
    const { data } = await admin
      .from('beatmakers')
      .select('stripe_account_id, stripe_compte_operationnel')
      .eq('id', beatmakerId)
      .maybeSingle()
    stocke = (data as CompteStocke | null) ?? { stripe_account_id: null, stripe_compte_operationnel: null }
  }

  const compteConnecte = !!stocke.stripe_account_id
  if (stocke.stripe_compte_operationnel) return { fournisseur: 'stripe', compteConnecte, operationnel: true }
  if (!stocke.stripe_account_id) return { fournisseur: 'stripe', compteConnecte: false, operationnel: false }

  try {
    const account = await stripe.accounts.retrieve(stocke.stripe_account_id)
    const operationnel = !!(account.charges_enabled && account.payouts_enabled)
    if (operationnel) {
      await admin.from('beatmakers').update({ stripe_compte_operationnel: true }).eq('id', beatmakerId)
    }
    return { fournisseur: 'stripe', compteConnecte, operationnel }
  } catch (err) {
    console.error('[payment-readiness] Erreur vérification compte Stripe', stocke.stripe_account_id, ':', err instanceof Error ? err.message : err)
    return { fournisseur: 'stripe', compteConnecte, operationnel: false }
  }
}
