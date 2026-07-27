import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique } from './email-logger'

// 15e — Renvoi manuel d'un email transactionnel/automatisation en échec,
// toutes boutiques confondues. Ne recalcule jamais le contenu d'origine :
// email_logs stocke déjà corps_html/corps_texte (email_logs_corps_migration.sql)
// au moment du premier envoi, donc le renvoi se contente de les rejouer tels
// quels via le même point de passage (envoyerEmailUnique), qui crée sa propre
// nouvelle ligne dans email_logs — l'historique garde donc trace des deux
// tentatives, sans jamais toucher à la logique webhook/checkout d'origine.
export async function renvoyerEmail(logId: string): Promise<{ ok: boolean; erreur?: string }> {
  const admin = createAdminClient()

  const { data: log } = await admin
    .from('email_logs')
    .select('beatmaker_id, destinataire, sujet, type, evenement, client_id, commande_id, automatisation_id, corps_html, corps_texte')
    .eq('id', logId)
    .maybeSingle()

  if (!log) return { ok: false, erreur: 'Log introuvable.' }
  if (!log.corps_html && !log.corps_texte) return { ok: false, erreur: 'Contenu d\'origine non disponible (email envoyé avant le suivi du corps).' }

  const { error } = await envoyerEmailUnique({
    beatmakerId: log.beatmaker_id,
    type: log.type as 'transactionnel' | 'automatisation',
    evenement: log.evenement,
    clientId: log.client_id,
    commandeId: log.commande_id,
    automatisationId: log.automatisation_id,
    to: log.destinataire,
    subject: log.sujet,
    html: log.corps_html ?? undefined,
    text: log.corps_texte ?? undefined,
  })

  if (error) return { ok: false, erreur: error instanceof Error ? error.message : JSON.stringify(error) }
  return { ok: true }
}
