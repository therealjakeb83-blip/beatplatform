import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'

// Suspendre/Réactiver une boutique (15c) — voir mémoire session 2026-07-24 :
// une boutique suspendue ne doit plus faire payer personne. La cascade pause
// (Stripe pause_collection, réversible — PAS une annulation) touche à la
// fois l'abonnement du beatmaker vers la plateforme et chaque abonnement
// artiste actif de sa boutique. `statut_avant_suspension` retient l'état réel
// pour que la réactivation restaure exactement le bon statut plutôt que de
// deviner 'actif'. `statut = 'suspendu'` n'est produit QUE par ce mécanisme :
// la réactivation ne touche donc jamais un abonnement déjà impayé/annulé
// pour une tout autre raison avant la suspension.

export type RapportSuspension = {
  plateforme: { existe: boolean; pause: boolean; erreur?: string }
  artistes: { total: number; reussis: number; ignores: number; echecs: { id: string; email: string | null; erreur: string }[] }
}

export async function suspendreBoutique(beatmakerId: string, raison: string): Promise<RapportSuspension> {
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, stripe_account_id')
    .eq('id', beatmakerId)
    .single()

  // 1. Bloque l'accès immédiatement (proxy.ts + boutique publique) — le plus
  // important, indépendant du succès des pauses Stripe qui suivent.
  await admin.from('beatmakers').update({
    statut: 'suspendu',
    suspendu_le: new Date().toISOString(),
    suspendu_raison: raison,
  }).eq('id', beatmakerId)

  // 2. Pause de l'abonnement plateforme (ce que le beatmaker paie à Jake)
  const rapportPlateforme: RapportSuspension['plateforme'] = { existe: false, pause: false }
  const { data: aboPlateforme } = await admin
    .from('abonnements_plateforme')
    .select('id, statut, stripe_subscription_id')
    .eq('beatmaker_id', beatmakerId)
    .in('statut', ['actif', 'en_essai'])
    .maybeSingle()

  if (aboPlateforme) {
    rapportPlateforme.existe = true
    if (aboPlateforme.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(aboPlateforme.stripe_subscription_id, {
          pause_collection: { behavior: 'void' },
        })
        await admin.from('abonnements_plateforme').update({
          statut: 'suspendu',
          statut_avant_suspension: aboPlateforme.statut,
        }).eq('id', aboPlateforme.id)
        rapportPlateforme.pause = true
      } catch (err) {
        rapportPlateforme.erreur = err instanceof Error ? err.message : String(err)
      }
    } else {
      rapportPlateforme.erreur = 'Aucun abonnement Stripe lié — à vérifier manuellement'
    }
  }

  // 3. Pause de chaque abonnement artiste actif (compte Stripe Connect du beatmaker)
  const { data: abosArtistes } = await admin
    .from('abonnements_boutique')
    .select('id, statut, stripe_subscription_id, acheteur_email')
    .eq('beatmaker_id', beatmakerId)
    .eq('statut', 'actif')

  const rapportArtistes: RapportSuspension['artistes'] = { total: abosArtistes?.length ?? 0, reussis: 0, ignores: 0, echecs: [] }

  for (const abo of abosArtistes ?? []) {
    if (!abo.stripe_subscription_id) {
      rapportArtistes.ignores++
      continue
    }
    try {
      // Un abonnement artiste ne vit sur le compte Connect du beatmaker que
      // si celui-ci était configuré au moment du checkout (transfer_data) —
      // sinon la subscription vit sur le compte principal. Découvert le
      // 2026-07-24 : ignorer purement et simplement dès que stripe_account_id
      // est absent aurait laissé de vrais abonnements sans Connect continuer
      // à facturer pendant une suspension.
      await stripe.subscriptions.update(
        abo.stripe_subscription_id,
        { pause_collection: { behavior: 'void' } },
        beatmaker?.stripe_account_id ? { stripeAccount: beatmaker.stripe_account_id } : undefined
      )
      await admin.from('abonnements_boutique').update({
        statut: 'suspendu',
        statut_avant_suspension: abo.statut,
      }).eq('id', abo.id)
      rapportArtistes.reussis++
    } catch (err) {
      rapportArtistes.echecs.push({ id: abo.id, email: abo.acheteur_email, erreur: err instanceof Error ? err.message : String(err) })
    }
  }

  return { plateforme: rapportPlateforme, artistes: rapportArtistes }
}

export async function reactiverBoutique(beatmakerId: string): Promise<RapportSuspension> {
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, stripe_account_id')
    .eq('id', beatmakerId)
    .single()

  await admin.from('beatmakers').update({
    statut: 'actif',
    suspendu_le: null,
    suspendu_raison: null,
  }).eq('id', beatmakerId)

  const rapportPlateforme: RapportSuspension['plateforme'] = { existe: false, pause: false }
  const { data: aboPlateforme } = await admin
    .from('abonnements_plateforme')
    .select('id, statut_avant_suspension, stripe_subscription_id')
    .eq('beatmaker_id', beatmakerId)
    .eq('statut', 'suspendu')
    .maybeSingle()

  if (aboPlateforme) {
    rapportPlateforme.existe = true
    if (aboPlateforme.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(aboPlateforme.stripe_subscription_id, { pause_collection: '' })
        await admin.from('abonnements_plateforme').update({
          statut: aboPlateforme.statut_avant_suspension ?? 'actif',
          statut_avant_suspension: null,
        }).eq('id', aboPlateforme.id)
        rapportPlateforme.pause = true
      } catch (err) {
        rapportPlateforme.erreur = err instanceof Error ? err.message : String(err)
      }
    } else {
      // Pas de subscription Stripe (déjà signalé à la suspension) — on
      // restaure quand même le statut logique en base.
      await admin.from('abonnements_plateforme').update({
        statut: aboPlateforme.statut_avant_suspension ?? 'actif',
        statut_avant_suspension: null,
      }).eq('id', aboPlateforme.id)
    }
  }

  const { data: abosArtistes } = await admin
    .from('abonnements_boutique')
    .select('id, statut_avant_suspension, stripe_subscription_id, acheteur_email')
    .eq('beatmaker_id', beatmakerId)
    .eq('statut', 'suspendu')

  const rapportArtistes: RapportSuspension['artistes'] = { total: abosArtistes?.length ?? 0, reussis: 0, ignores: 0, echecs: [] }

  for (const abo of abosArtistes ?? []) {
    if (!abo.stripe_subscription_id) {
      rapportArtistes.ignores++
      await admin.from('abonnements_boutique').update({
        statut: abo.statut_avant_suspension ?? 'actif',
        statut_avant_suspension: null,
      }).eq('id', abo.id)
      continue
    }
    try {
      await stripe.subscriptions.update(
        abo.stripe_subscription_id,
        { pause_collection: '' },
        beatmaker?.stripe_account_id ? { stripeAccount: beatmaker.stripe_account_id } : undefined
      )
      await admin.from('abonnements_boutique').update({
        statut: abo.statut_avant_suspension ?? 'actif',
        statut_avant_suspension: null,
      }).eq('id', abo.id)
      rapportArtistes.reussis++
    } catch (err) {
      rapportArtistes.echecs.push({ id: abo.id, email: abo.acheteur_email, erreur: err instanceof Error ? err.message : String(err) })
    }
  }

  return { plateforme: rapportPlateforme, artistes: rapportArtistes }
}
