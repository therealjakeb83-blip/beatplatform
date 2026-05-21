import { createClient } from '@/utils/supabase/server'
import { lierCompteClient } from '@/lib/lier-compte-client'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { nom, prenom, newsletter_consent } = body as { nom?: string; prenom?: string; newsletter_consent?: boolean }

  const meta = user.user_metadata as { prenom?: string; nom?: string } | undefined
  const finalNom = nom || meta?.nom
  const finalPrenom = prenom || meta?.prenom

  await lierCompteClient(user.id, user.email, finalNom, finalPrenom, newsletter_consent)

  return NextResponse.json({ ok: true })
}
