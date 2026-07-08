import { createAdminClient } from '@/utils/supabase/admin'
import { getResend } from './resend'

export type TypeEmailLog = 'transactionnel' | 'campagne' | 'automatisation'

const FROM_DEFAUT = 'My Producer <noreply@jakebmusic.com>'

type ContexteEnvoi = {
  beatmakerId: string
  type: TypeEmailLog
  evenement: string
  clientId?: string | null
  commandeId?: string | null
  campagneId?: string | null
  automatisationId?: string | null
}

async function enregistrer(
  ctx: ContexteEnvoi,
  destinataire: string,
  sujet: string,
  resultat: { messageId?: string | null; erreur?: string | null },
) {
  const admin = createAdminClient()
  const { error } = await admin.from('email_logs').insert({
    beatmaker_id: ctx.beatmakerId,
    destinataire,
    sujet,
    type: ctx.type,
    evenement: ctx.evenement,
    statut: resultat.erreur ? 'echoue' : 'envoye',
    erreur: resultat.erreur ?? null,
    resend_message_id: resultat.messageId ?? null,
    client_id: ctx.clientId ?? null,
    commande_id: ctx.commandeId ?? null,
    campagne_id: ctx.campagneId ?? null,
    automatisation_id: ctx.automatisationId ?? null,
  })
  if (error) console.error('[email-logger] Erreur insertion email_logs:', JSON.stringify(error))
}

// Point de passage unique pour tout envoi individuel — utilisé par le
// transactionnel (lib/emails.ts) et les automatisations. Ne lève jamais
// d'exception : le résultat Resend (data/error) est toujours retourné,
// à l'appelant de décider s'il doit bloquer sur l'échec.
export async function envoyerEmailUnique(ctx: ContexteEnvoi & {
  to: string
  subject: string
  html?: string
  text?: string
  from?: string
}) {
  try {
    const base = { from: ctx.from ?? FROM_DEFAUT, to: ctx.to, subject: ctx.subject }
    const { data, error } = await getResend().emails.send(
      ctx.html ? { ...base, html: ctx.html } : { ...base, text: ctx.text ?? '' }
    )
    await enregistrer(ctx, ctx.to, ctx.subject, {
      messageId: data?.id ?? null,
      erreur: error ? JSON.stringify(error) : null,
    })
    return { data, error }
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err)
    await enregistrer(ctx, ctx.to, ctx.subject, { erreur })
    return { data: null, error: err }
  }
}

export type DestinataireLot = { to: string; subject: string; html: string; clientId?: string | null }

// Variante batch — utilisée par les campagnes (lib/mailing.ts). Logge une
// ligne par destinataire, y compris en cas d'échec du lot entier.
export async function envoyerLotEmails(
  ctx: Omit<ContexteEnvoi, 'clientId'>,
  from: string,
  destinataires: DestinataireLot[],
) {
  try {
    const { data, error } = await getResend().batch.send(
      destinataires.map(d => ({ from, to: d.to, subject: d.subject, html: d.html })),
    )
    if (error || !data) {
      const erreur = JSON.stringify(error)
      await Promise.all(destinataires.map(d =>
        enregistrer({ ...ctx, clientId: d.clientId }, d.to, d.subject, { erreur })
      ))
      return { data: null, error }
    }
    await Promise.all(destinataires.map((d, idx) =>
      enregistrer({ ...ctx, clientId: d.clientId }, d.to, d.subject, { messageId: data.data[idx]?.id ?? null })
    ))
    return { data, error: null }
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err)
    await Promise.all(destinataires.map(d =>
      enregistrer({ ...ctx, clientId: d.clientId }, d.to, d.subject, { erreur })
    ))
    return { data: null, error: err }
  }
}
