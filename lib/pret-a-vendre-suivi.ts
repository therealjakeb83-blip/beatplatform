import type Stripe from 'stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { calculerPretAVendreOuExempte } from '@/lib/pret-a-vendre'
import { notifierPauseCollab } from '@/lib/collaboration-pause'

/**
 * Recalcule et enregistre le statut « prêt à vendre » d'un beatmaker
 * (beatmakers.pret_a_vendre_concedant / _collaborateur — Phase 12 lot 4).
 * La base retire alors de la boutique, ou y remet, les beats collab où il
 * vend. Au passage prêt → pas prêt, A et B de chaque beat concerné sont
 * prévenus. À appeler après chaque réglage qui compte (paiements, relevé,
 * mandats, TVA, adresse, pages légales, exemption admin) et à chaque
 * account.updated de Stripe. Ne lève jamais d'exception : un réglage
 * enregistré ne doit pas échouer à cause de ce suivi.
 */
export async function rafraichirPretAVendre(beatmakerId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: avant } = await admin
      .from('beatmakers')
      .select('pret_a_vendre_concedant, pret_a_vendre_collaborateur')
      .eq('id', beatmakerId)
      .maybeSingle()
    if (!avant) return

    const [concedant, collaborateur] = await Promise.all([
      calculerPretAVendreOuExempte(admin, beatmakerId, { estConcedant: true }),
      calculerPretAVendreOuExempte(admin, beatmakerId, { estConcedant: false }),
    ])
    if (avant.pret_a_vendre_concedant === concedant.pret && avant.pret_a_vendre_collaborateur === collaborateur.pret) return

    const { error } = await admin
      .from('beatmakers')
      .update({ pret_a_vendre_concedant: concedant.pret, pret_a_vendre_collaborateur: collaborateur.pret })
      .eq('id', beatmakerId)
    if (error) {
      console.error('[pret-a-vendre-suivi] Erreur enregistrement pour', beatmakerId, ':', JSON.stringify(error))
      return
    }

    const perdu = {
      commeProprietaire: !!avant.pret_a_vendre_concedant && !concedant.pret,
      commeCollaborateur: !!avant.pret_a_vendre_collaborateur && !collaborateur.pret,
    }
    if (perdu.commeProprietaire || perdu.commeCollaborateur) {
      await notifierPauseCollab(admin, beatmakerId, perdu)
    }
  } catch (err) {
    console.error('[pret-a-vendre-suivi] Erreur pour', beatmakerId, ':', err instanceof Error ? err.message : err)
  }
}

/**
 * account.updated de Stripe (Phase 12 lot 2) : tient à jour
 * beatmakers.stripe_compte_operationnel, dans les deux sens — un compte que
 * Stripe suspend fait sortir de la boutique les beats collab où il vend.
 * Reçu sur /api/stripe/webhook-connect : l'event d'un compte connecté
 * n'arrive jamais sur le webhook plateforme (bug trouvé en Phase 13 lot 1).
 */
export async function traiterMajCompteOperationnel(account: Stripe.Account) {
  const operationnel = !!(account.charges_enabled && account.payouts_enabled)
  const supabase = createAdminClient()

  const { data: avant } = await supabase
    .from('beatmakers')
    .select('id, stripe_compte_operationnel')
    .eq('stripe_account_id', account.id)
    .maybeSingle()
  if (!avant || !!avant.stripe_compte_operationnel === operationnel) return

  const { error } = await supabase
    .from('beatmakers')
    .update({ stripe_compte_operationnel: operationnel })
    .eq('id', avant.id)

  if (error) {
    console.error('[webhook] Erreur maj stripe_compte_operationnel pour', account.id, ':', JSON.stringify(error))
    return
  }
  // Phase 12 lot 4 : le statut « prêt à vendre » en dépend — les beats collab
  // où il vend sortent de la boutique (ou y reviennent), A et B prévenus.
  await rafraichirPretAVendre(avant.id as string)
}
