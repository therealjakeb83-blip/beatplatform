import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect') ?? '/'
  const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
  const supabase = await createClient()
  await supabase.auth.signOut()

  const response = NextResponse.redirect(new URL(safeRedirect, request.url), { status: 303 })

  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith('abo_')) {
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' })
    }
  }

  return response
}
