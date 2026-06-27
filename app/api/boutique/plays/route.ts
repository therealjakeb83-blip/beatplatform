import { createAdminClient } from '@/utils/supabase/admin'
import { createClient }       from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const beat_id: string | undefined = body?.beat_id
  if (!beat_id) return NextResponse.json({ ok: false }, { status: 400 })

  const admin    = createAdminClient()
  const supabase = await createClient()

  const [{ data: beat }, { data: { user } }] = await Promise.all([
    admin.from('beats').select('beatmaker_id').eq('id', beat_id).single(),
    supabase.auth.getUser(),
  ])

  if (!beat) return NextResponse.json({ ok: false }, { status: 404 })

  // Lier au compte client si l'auditeur est connecté (vérifier qu'il existe dans clients, pas beatmakers)
  let client_id: string | null = null
  if (user) {
    const { data: clientRow } = await admin.from('clients').select('id').eq('id', user.id).single()
    if (clientRow) client_id = user.id
  }

  const { error } = await admin
    .from('beat_plays')
    .insert({ beat_id, beatmaker_id: beat.beatmaker_id, client_id })

  if (error) {
    console.error('[boutique/plays]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
