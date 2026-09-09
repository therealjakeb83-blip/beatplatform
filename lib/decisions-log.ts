import { createAdminClient } from '@/utils/supabase/admin'

// Journal des décisions commerciales/juridiques (Phase 7 du chantier 9 bis)
// — preuve de la séparation des rôles, pas un log technique. Ne jamais
// appeler ce point de passage pour un événement purement technique (retry,
// webhook, erreur d'infra) : ça reste dans l'observabilité de la Phase 5.
// Voir memory project_grillme_9bis_synthese, section "Décisions
// architecturales clés retenues".

export type ActeurDecision = 'beatmaker' | 'admin'
export type EntiteDecision = 'commande' | 'boutique' | 'page_legale' | 'licence_texte'

type DecisionLog = {
  beatmakerId: string
  actorType: ActeurDecision
  actorId: string
  entityType: EntiteDecision
  entityId: string
  action: string
  motif?: string | null
  referenceVersion?: string | null
  details?: Record<string, unknown> | null
}

// Ne lève jamais d'exception : un échec de journalisation ne doit jamais
// faire échouer la décision commerciale elle-même (remboursement déjà
// effectué côté Stripe, par ex.) — juste loggé pour investigation.
export async function journaliserDecision(decision: DecisionLog): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('merchant_decisions_log').insert({
    beatmaker_id: decision.beatmakerId,
    actor_type: decision.actorType,
    actor_id: decision.actorId,
    entity_type: decision.entityType,
    entity_id: decision.entityId,
    action: decision.action,
    motif: decision.motif ?? null,
    reference_version: decision.referenceVersion ?? null,
    details: decision.details ?? null,
  })

  if (error) console.error('[decisions-log] Erreur insertion merchant_decisions_log:', JSON.stringify(error))
}
