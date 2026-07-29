import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAdmin } from '@/lib/admin'
import { envoyerEmailUnique } from '@/lib/email-logger'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await estAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: log } = await admin
    .from('email_logs')
    .select('beatmaker_id, destinataire, sujet, type, evenement, corps_html, corps_texte')
    .eq('id', id)
    .like('evenement', 'plateforme_%')
    .single()

  if (!log) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!log.corps_html && !log.corps_texte) {
    return NextResponse.json({ error: "Contenu indisponible pour cet email (envoyé avant l'historisation du contenu)" }, { status: 400 })
  }

  const { error } = await envoyerEmailUnique({
    beatmakerId: log.beatmaker_id,
    type: log.type as 'transactionnel' | 'automatisation',
    evenement: log.evenement,
    to: log.destinataire,
    subject: log.sujet,
    ...(log.corps_html ? { html: log.corps_html } : { text: log.corps_texte ?? undefined }),
  })

  if (error) return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
