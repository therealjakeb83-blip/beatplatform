import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchit la session si elle est expirée — ne pas ajouter de logique entre ici et getUser()
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes dashboard — réservées aux beatmakers uniquement
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/connexion'
      return NextResponse.redirect(url)
    }

    // Vérifier que l'utilisateur est bien un beatmaker
    const { data: beatmaker } = await supabase
      .from('beatmakers')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!beatmaker) {
      const url = request.nextUrl.clone()
      url.pathname = '/mon-compte'
      return NextResponse.redirect(url)
    }
  }

  // Pages auth beatmaker — redirige vers /dashboard si déjà connecté en tant que beatmaker
  if ((pathname === '/connexion' || pathname === '/inscription') && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
