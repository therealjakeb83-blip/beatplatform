import { createClient } from '@/utils/supabase/server'
import { envoyerBienvenuePlateforme } from '@/lib/emails'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Appelé côté client juste après supabase.auth.signUp() (app/inscription) —
// la ligne `beatmakers` existe déjà à ce moment-là (trigger Postgres
// on_auth_user_created, synchrone avec l'insert dans auth.users), donc pas
// besoin d'attendre/retenter.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { data: beatmaker } = await supabase.from('beatmakers').select('email').eq('id', user.id).maybeSingle()
  if (beatmaker) {
    await envoyerBienvenuePlateforme({ to: beatmaker.email, beatmakerId: user.id })
  }

  return NextResponse.json({ ok: true })
}
