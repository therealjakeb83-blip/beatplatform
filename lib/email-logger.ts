import { createAdminClient } from '@/utils/supabase/admin'
import { getResend } from './resend'
import { NOM_PLATEFORME, EMAIL_EXPEDITEUR_PLATEFORME } from './constantes'
import { envoiAutorise, MOTIF_BLOCAGE_LISTE_BLANCHE } from './email-liste-blanche'
import { normaliserEmail } from './email'

// Les campagnes (envoi de masse) ne passent volontairement pas par ce
// logger : leur historique détaillé par destinataire vit déjà dans
// campagne_envois et s'affiche sur la page Campagnes — le dupliquer ici
// noierait la liste sous des milliers de lignes identiques.
export type TypeEmailLog = 'transactionnel' | 'automatisation'

const FROM_DEFAUT = `${NOM_PLATEFORME} <${EMAIL_EXPEDITEUR_PLATEFORME}>`

type ContexteEnvoi = {
  // null = email de Sonoo hors de toute boutique, invisible des beatmakers.
  beatmakerId: string | null
  type: TypeEmailLog
  evenement: string
  clientId?: string | null
  commandeId?: string | null
  automatisationId?: string | null
}

async function enregistrer(
  ctx: ContexteEnvoi,
  destinataire: string,
  sujet: string,
  corps: { html?: string | null; texte?: string | null },
  resultat: { messageId?: string | null; erreur?: string | null },
) {
  const admin = createAdminClient()
  const ligne = {
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
    automatisation_id: ctx.automatisationId ?? null,
    corps_html: corps.html ?? null,
    corps_texte: corps.texte ?? null,
  }
  let { error } = await admin.from('email_logs').insert(ligne)

  // Fiche client disparue entre l'envoi et le journal : la fiche provisoire d'un
  // visiteur est fusionnée dans son vrai compte quand il choisit son mot de passe,
  // parfois pendant que le webhook Stripe envoie l'email (bug du 2026-11-11). On
  // rattache alors l'email à la fiche actuelle de ce client, retrouvée par son email.
  if (error?.code === '23503' && error.message.includes('email_logs_client_id_fkey')) {
    const { data: client } = await admin.from('clients').select('id').eq('email', normaliserEmail(destinataire)).maybeSingle()
    ;({ error } = await admin.from('email_logs').insert({ ...ligne, client_id: client?.id ?? null }))
  }
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
  // Corps enregistré à la place du vrai (lien de connexion masqué).
  htmlJournal?: string
}) {
  const corpsJournal = { html: ctx.htmlJournal ?? ctx.html, texte: ctx.text }
  // Bloqué = « fait comme si » pour l'appelant (sinon une automatisation
  // réessaierait à chaque passage du cron), mais tracé en échec dans les logs.
  if (!envoiAutorise(ctx.to)) {
    await enregistrer(ctx, ctx.to, ctx.subject, corpsJournal, {
      erreur: MOTIF_BLOCAGE_LISTE_BLANCHE,
    })
    return { data: { id: null as string | null }, error: null }
  }
  try {
    const base = { from: ctx.from ?? FROM_DEFAUT, to: ctx.to, subject: ctx.subject }
    const { data, error } = await getResend().emails.send(
      ctx.html ? { ...base, html: ctx.html } : { ...base, text: ctx.text ?? '' }
    )
    await enregistrer(ctx, ctx.to, ctx.subject, corpsJournal, {
      messageId: data?.id ?? null,
      erreur: error ? JSON.stringify(error) : null,
    })
    return { data, error }
  } catch (err) {
    const erreur = err instanceof Error ? err.message : String(err)
    await enregistrer(ctx, ctx.to, ctx.subject, corpsJournal, { erreur })
    return { data: null, error: err }
  }
}

export type DestinataireLot = { to: string; subject: string; html: string }

// Variante batch — utilisée par les campagnes (lib/mailing.ts). Ne logge
// pas dans email_logs (voir note sur TypeEmailLog plus haut) : l'appelant
// gère lui-même le suivi via campagne_envois.
// Les destinataires hors liste blanche sont retirés du lot ; la réponse garde
// l'ordre d'origine (id null pour un bloqué) car l'appelant indexe par position.
export async function envoyerLotEmails(from: string, destinataires: DestinataireLot[]) {
  const autorises = destinataires.filter(d => envoiAutorise(d.to))
  if (autorises.length < destinataires.length) {
    console.warn(`[email-logger] ${destinataires.length - autorises.length} destinataire(s) de campagne — ${MOTIF_BLOCAGE_LISTE_BLANCHE}`)
  }

  let ids: (string | null)[] = []
  if (autorises.length > 0) {
    const { data, error } = await getResend().batch.send(
      autorises.map(d => ({ from, to: d.to, subject: d.subject, html: d.html })),
    )
    if (error || !data) return { data: null, error }
    ids = data.data.map(r => r.id)
  }

  let i = 0
  return {
    data: { data: destinataires.map(d => ({ id: envoiAutorise(d.to) ? (ids[i++] ?? null) : null })) },
    error: null,
  }
}
