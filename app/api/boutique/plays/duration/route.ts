import { createAdminClient } from '@/utils/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { play_id, duree_secondes } = body ?? {}

  if (!play_id || typeof duree_secondes !== 'number' || duree_secondes < 0) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('beat_plays')
    .update({ duree_secondes: Math.round(duree_secondes) })
    .eq('id', play_id)

  if (error) console.error('[plays/duration]', error)
  return NextResponse.json({ ok: true })
}
