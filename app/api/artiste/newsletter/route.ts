import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { newsletter_consent } = body as { newsletter_consent?: boolean }

  if (typeof newsletter_consent !== 'boolean') {
    return NextResponse.json({ erreur: 'Valeur invalide' }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin.from('clients').update({ newsletter_consent }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
