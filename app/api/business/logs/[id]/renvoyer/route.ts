import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique, type TypeEmailLog } from '@/lib/email-logger'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()

  const { data: log } = await admin
    .from('email_logs')
    .select('destinataire, sujet, type, evenement, corps_html, corps_texte, client_id, commande_id, automatisation_id')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!log) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!log.corps_html && !log.corps_texte) {
    return NextResponse.json({ error: "Contenu indisponible pour cet email (envoyé avant l'historisation du contenu)" }, { status: 400 })
  }

  const { error } = await envoyerEmailUnique({
    beatmakerId: user.id,
    type: log.type as TypeEmailLog,
    evenement: log.evenement,
    clientId: log.client_id,
    commandeId: log.commande_id,
    automatisationId: log.automatisation_id,
    to: log.destinataire,
    subject: log.sujet,
    ...(log.corps_html ? { html: log.corps_html } : { text: log.corps_texte ?? undefined }),
  })

  if (error) return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
