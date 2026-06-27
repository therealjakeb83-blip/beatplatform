import { createAdminClient } from '@/utils/supabase/admin'
import { createClient }       from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const VALID_SOURCES = ['instagram', 'youtube', 'google', 'direct', 'autre'] as const
type Source = typeof VALID_SOURCES[number]

function detectDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/mobile|android|iphone|ipod/i.test(ua)) return 'mobile'
  if (/ipad|tablet/i.test(ua)) return 'tablet'
  return 'desktop'
}

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

  // Client connecté
  let client_id: string | null = null
  if (user) {
    const { data: clientRow } = await admin.from('clients').select('id').eq('id', user.id).single()
    if (clientRow) client_id = user.id
  }

  // Pays (header Vercel, RGPD-safe — pas d'IP stockée)
  const pays = req.headers.get('x-vercel-ip-country') ?? null

  // Device type
  const ua          = req.headers.get('user-agent') ?? ''
  const device_type = detectDevice(ua)

  // Source marketing
  const rawSource       = String(body?.source_marketing ?? 'direct').toLowerCase()
  const source_marketing: Source = VALID_SOURCES.includes(rawSource as Source) ? rawSource as Source : 'autre'

  const { error } = await admin
    .from('beat_plays')
    .insert({ beat_id, beatmaker_id: beat.beatmaker_id, client_id, pays, device_type, source_marketing })

  if (error) {
    console.error('[boutique/plays]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
