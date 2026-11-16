import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supprimerCompteClient } from '@/lib/suppression-compte'

// « Supprimer mon compte » (9d lot 4) : compte Sonoo de la personne (Sonoo
// responsable). Session obligatoire, jamais le cookie d'abonné. Newsletter
// désinscrite seulement chez les boutiques cochées (lib/suppression-compte.ts).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connecte-toi pour supprimer ton compte.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body?.confirmation !== 'SUPPRIMER') {
    return NextResponse.json({ error: 'Tape SUPPRIMER pour confirmer.' }, { status: 400 })
  }
  const desinscrire = Array.isArray(body?.desinscrire)
    ? (body.desinscrire as unknown[]).filter((v): v is string => typeof v === 'string')
    : []

  const r = await supprimerCompteClient({ clientId: user.id, desinscrire })
  if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: r.statut })

  await supabase.auth.signOut().catch(() => {})
  const reponse = NextResponse.json({ ok: true })
  const cookieStore = await cookies()
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('abo_')) reponse.cookies.set(c.name, '', { maxAge: 0, path: '/' })
  }
  return reponse
}
