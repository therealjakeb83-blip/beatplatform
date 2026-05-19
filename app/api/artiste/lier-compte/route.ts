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
  const { nom, prenom } = body as { nom?: string; prenom?: string }

  await lierCompteClient(user.id, user.email, nom, prenom)

  return NextResponse.json({ ok: true })
}
