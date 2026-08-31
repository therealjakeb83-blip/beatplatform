import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { estRoleAdmin } from '@/lib/admin'

// Délai maximum accordé à Supabase pour répondre à CHAQUE requête faite par
// proxy.ts sur une page /dashboard (proxy.ts s'exécute avant tout rendu).
// Sans cette limite, un ralentissement ponctuel de Supabase (ex. incident de
// leur côté, 2026-08-28) bloque le site entier pendant les 5 minutes du
// timeout Vercel — vécu en conditions réelles, jamais anticipé avant.
//
// Bug corrigé le 2026-08-31 : le chrono initial ne protégeait QUE le premier
// appel (`getUser()`). Les deux requêtes suivantes (ligne `beatmakers`, puis
// abonnement plateforme actif) n'avaient aucune limite — si l'auth répond
// vite mais que CES requêtes-là traînent (le profil exact de l'incident
// Supabase "temps de réponse augmentés" du 27-29/08, qui touche l'API de
// données plus que l'auth), le site restait bloqué sans jamais passer par
// /verification-en-cours. Chaque appel Supabase de ce fichier doit désormais
// passer par `avecTimeout()`.
const TIMEOUT_VERIFICATION_MS = 5000

function avecTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout vérification session')), TIMEOUT_VERIFICATION_MS)
  )
  return Promise.race([Promise.resolve(promise), timeout])
}

type BeatmakerGate = { id: string; statut: string; role: string; abonnement_exempte: boolean }

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

  const { pathname } = request.nextUrl

  function versVerificationEnCours() {
    const url = request.nextUrl.clone()
    url.pathname = '/verification-en-cours'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Rafraîchit la session si elle est expirée — ne pas ajouter de logique entre ici et getUser()
  // Un timeout ici (comme sur les requêtes suivantes) signifie "Supabase n'a pas répondu à temps",
  // PAS "l'utilisateur n'est pas connecté" — distinction volontaire : une vraie absence de session
  // redirige vers /connexion (comportement normal), un simple délai dépassé redirige vers
  // /verification-en-cours (jamais vers le formulaire de connexion, pour ne pas laisser croire à
  // une déconnexion ou un mot de passe refusé).
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data } = await avecTimeout(supabase.auth.getUser())
    user = data.user
  } catch {
    if (pathname.startsWith('/dashboard')) return versVerificationEnCours()
  }

  // Routes dashboard — réservées aux beatmakers uniquement
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/connexion'
      return NextResponse.redirect(url)
    }

    // Vérifier que l'utilisateur est bien un beatmaker
    let beatmaker: BeatmakerGate | null = null
    try {
      const { data } = await avecTimeout(
        supabase
          .from('beatmakers')
          .select('id, statut, role, abonnement_exempte')
          .eq('id', user.id)
          .single()
      )
      beatmaker = data
    } catch {
      return versVerificationEnCours()
    }

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
    const gateExempte = estRoleAdmin(beatmaker.role) || beatmaker.abonnement_exempte
    if (!gateExempte && pathname !== '/dashboard/abonnement' && pathname !== '/dashboard/suspendu') {
      let abonnementActif: { id: string } | null = null
      try {
        const { data } = await avecTimeout(
          supabase
            .from('abonnements_plateforme')
            .select('id')
            .eq('beatmaker_id', beatmaker.id)
            .in('statut', ['actif', 'en_essai'])
            .limit(1)
            .maybeSingle()
        )
        abonnementActif = data
      } catch {
        return versVerificationEnCours()
      }

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
