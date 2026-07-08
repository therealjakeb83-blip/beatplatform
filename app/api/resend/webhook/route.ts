import { getResend } from '@/lib/resend'
import { incrementerCompteurCampagne } from '@/lib/mailing'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const payload = await request.text()
  const svixId        = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ erreur: 'En-têtes de signature manquants' }, { status: 400 })
  }

  let event
  try {
    event = getResend().webhooks.verify({
      payload,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    })
  } catch {
    return NextResponse.json({ erreur: 'Signature invalide' }, { status: 400 })
  }

  if (
    event.type !== 'email.opened' &&
    event.type !== 'email.clicked' &&
    event.type !== 'email.bounced' &&
    event.type !== 'email.complained'
  ) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()

  const { data: log } = await admin
    .from('email_logs')
    .select('id, ouvert_at, clique_at')
    .eq('resend_message_id', event.data.email_id)
    .maybeSingle()

  if (log) {
    if (event.type === 'email.opened' && !log.ouvert_at) {
      await admin.from('email_logs').update({ ouvert_at: new Date().toISOString() }).eq('id', log.id)
    }
    if (event.type === 'email.clicked' && !log.clique_at) {
      await admin.from('email_logs').update({ clique_at: new Date().toISOString() }).eq('id', log.id)
    }
    if (event.type === 'email.bounced' || event.type === 'email.complained') {
      await admin.from('email_logs').update({ statut: 'echoue' }).eq('id', log.id)
    }
  }

  const { data: envoi } = await admin
    .from('campagne_envois')
    .select('id, campagne_id, ouvert_at, clique_at')
    .eq('resend_message_id', event.data.email_id)
    .maybeSingle()

  // Pas de correspondance = email transactionnel/automatisation, pas une campagne
  if (!envoi) return NextResponse.json({ ok: true })

  if (event.type === 'email.opened' && !envoi.ouvert_at) {
    await admin.from('campagne_envois').update({ ouvert_at: new Date().toISOString() }).eq('id', envoi.id)
    await incrementerCompteurCampagne(envoi.campagne_id, 'ouvertures')
  }

  if (event.type === 'email.clicked' && !envoi.clique_at) {
    await admin.from('campagne_envois').update({ clique_at: new Date().toISOString() }).eq('id', envoi.id)
    await incrementerCompteurCampagne(envoi.campagne_id, 'clics')
  }

  if (event.type === 'email.bounced') {
    await admin.from('campagne_envois').update({ bounce: true }).eq('id', envoi.id)
  }

  if (event.type === 'email.complained') {
    await admin.from('campagne_envois').update({ plainte: true }).eq('id', envoi.id)
  }

  return NextResponse.json({ ok: true })
}
