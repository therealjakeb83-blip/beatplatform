import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SLUG_ADMIN } from '@/lib/admin'

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
      .select('id, statut, slug, abonnement_exempte')
      .eq('id', user.id)
      .single()

    if (!beatmaker) {
      const url = request.nextUrl.clone()
      url.pathname = '/mon-compte'
      return NextResponse.redirect(url)
    }

    // Boutique suspendue depuis l'admin (Étape 15c) — coupe l'accès au
    // dashboard immédiatement, sauf à la page d'explication elle-même.
    if (beatmaker.statut === 'suspendu' && pathname !== '/dashboard/suspendu') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/suspendu'
      return NextResponse.redirect(url)
    }

    // Étape 8b — gate abonnement plateforme. Le compte admin et les
    // boutiques de test exemptées (`abonnement_exempte`, laisser-passer
    // admin) ne sont jamais bloqués. `/dashboard/abonnement` reste toujours
    // accessible pour permettre de souscrire.
    const gateExempte = beatmaker.slug === SLUG_ADMIN || beatmaker.abonnement_exempte
    if (!gateExempte && pathname !== '/dashboard/abonnement' && pathname !== '/dashboard/suspendu') {
      const { data: abonnementActif } = await supabase
        .from('abonnements_plateforme')
        .select('id')
        .eq('beatmaker_id', beatmaker.id)
        .in('statut', ['actif', 'en_essai'])
        .limit(1)
        .maybeSingle()

      if (!abonnementActif) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/abonnement'
        return NextResponse.redirect(url)
      }
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
