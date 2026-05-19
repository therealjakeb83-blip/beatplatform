import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect') ?? '/'
  const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL(safeRedirect, request.url), { status: 303 })
}
