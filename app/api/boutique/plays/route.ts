import { createAdminClient } from '@/utils/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const beat_id: string | undefined = body?.beat_id
  if (!beat_id) return NextResponse.json({ ok: false }, { status: 400 })

  const admin = createAdminClient()

  const { data: beat } = await admin
    .from('beats')
    .select('beatmaker_id')
    .eq('id', beat_id)
    .single()

  if (!beat) return NextResponse.json({ ok: false }, { status: 404 })

  const { error } = await admin
    .from('beat_plays')
    .insert({ beat_id, beatmaker_id: beat.beatmaker_id, client_id: null })

  if (error) {
    console.error('[boutique/plays]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
