import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { estRoleAdmin } from '@/lib/admin'
import { aUnAbonnementPlateformeActif, pageAccessibleEnPlanFree } from '@/lib/acces-plan'
import { COOKIE_MAINTENANCE, cheminFermeEnMaintenance, jetonMaintenanceValide, maintenanceActive } from '@/lib/maintenance'
import { URL_APP } from '@/lib/constantes'
import { CHEMIN_SONDE, SIGNATURE_SONDE, estHotePlateforme, estHoteSonoo, hoteSansPort, routeSurDomaine, slugDuChemin } from '@/lib/domaine-boutique'
import { createAdminClient } from '@/utils/supabase/admin'

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

// Quelques secondes de mémoire : chaque page d'une boutique déclenche plusieurs
// requêtes, inutile de consulter la base à chaque fois.
const MEMOIRE_DOMAINE_MS = 30_000
const MEMOIRE_MAX_ENTREES = 5_000
const memoireDomaines = new Map<string, { slug: string | null; expire: number }>()
const memoireRedirections = new Map<string, { domaine: string | null; expire: number }>()

async function domaineActifDuSlug(slug: string): Promise<string | null> {
  const memorise = memoireRedirections.get(slug)
  if (memorise && memorise.expire > Date.now()) return memorise.domaine

  const { data, error } = await avecTimeout(
    createAdminClient()
      .from('domaines_boutique')
      .select('domaine, beatmakers!inner(slug)')
      .eq('statut', 'actif')
      .eq('beatmakers.slug', slug)
      .maybeSingle()
  )
  if (error) throw error

  const domaine = (data?.domaine as string | undefined) ?? null
  if (memoireRedirections.size >= MEMOIRE_MAX_ENTREES) memoireRedirections.clear()
  memoireRedirections.set(slug, { domaine, expire: Date.now() + MEMOIRE_DOMAINE_MS })
  return domaine
}

// Temporaire (307) et non définitive : un navigateur garde une redirection
// définitive en mémoire et continuerait d'envoyer vers un domaine tombé en panne.
// Au moindre doute, null : la boutique s'affiche normalement sur sonoo.app.
async function redirectionVersDomaine(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const { pathname, search } = request.nextUrl
  const slug = slugDuChemin(pathname)
  if (!slug) return null

  let domaine: string | null
  try {
    domaine = await domaineActifDuSlug(slug)
  } catch {
    return null
  }
  if (!domaine) return null
  return NextResponse.redirect(`https://${domaine}${pathname.slice(slug.length + 1)}${search}`, 307)
}

async function slugDuDomaine(hote: string): Promise<string | null> {
  const memorise = memoireDomaines.get(hote)
  if (memorise && memorise.expire > Date.now()) return memorise.slug

  const { data, error } = await avecTimeout(
    createAdminClient()
      .from('domaines_boutique')
      .select('beatmakers(slug)')
      .eq('domaine', hote)
      .eq('statut', 'actif')
      .maybeSingle()
  )
  if (error) throw error

  const beatmaker = data?.beatmakers as unknown as { slug: string | null } | null | undefined
  const slug = beatmaker?.slug ?? null
  if (memoireDomaines.size >= MEMOIRE_MAX_ENTREES) memoireDomaines.clear()
  memoireDomaines.set(hote, { slug, expire: Date.now() + MEMOIRE_DOMAINE_MS })
  return slug
}

async function reponseDomaineBoutique(request: NextRequest, hote: string) {
  if (request.nextUrl.pathname === CHEMIN_SONDE) {
    return NextResponse.json({ sonoo: SIGNATURE_SONDE }, { headers: { 'cache-control': 'no-store' } })
  }

  let slug: string | null
  try {
    slug = await slugDuDomaine(hote)
  } catch {
    return new NextResponse('Cette boutique est momentanément injoignable. Réessaie dans un instant.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '10' },
    })
  }
  if (!slug) {
    return new NextResponse('Aucune boutique à cette adresse.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const { pathname, search } = request.nextUrl
  const route = routeSurDomaine(pathname)
  if (route === 'plateforme') return NextResponse.redirect(new URL(pathname + search, URL_APP))
  if (route === 'direct') return avecSessionRafraichie(request, () => NextResponse.next({ request }))

  const url = request.nextUrl.clone()
  if (route === 'paiement') {
    // Adresse publique : domaine/paiement. L'ancienne forme avec le slug
    // (liens ou retours Stripe déjà partis) y est renvoyée.
    const reste = pathname.slice('/paiement'.length).replace(/\/$/, '')
    if (reste === `/${slug}`) {
      url.pathname = '/paiement'
      return NextResponse.redirect(url, 307)
    }
    if (reste !== '') return new NextResponse('Page introuvable.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    url.pathname = `/paiement/${slug}`
  } else {
    url.pathname = pathname === '/' ? `/${slug}` : `/${slug}${pathname}`
  }
  return avecSessionRafraichie(request, () => NextResponse.rewrite(url, { request }))
}

// Sur sonoo.app, la session du client est rafraîchie plus bas à chaque page ;
// sur un domaine aussi, sinon il serait déconnecté au bout d'environ une heure
// (une page serveur ne peut pas réécrire les cookies de session). Seulement si
// le visiteur a une session : aucun appel à Supabase pour les autres.
async function avecSessionRafraichie(request: NextRequest, fabriquer: () => NextResponse): Promise<NextResponse> {
  let reponse = fabriquer()
  if (!request.cookies.getAll().some(c => c.name.startsWith('sb-'))) return reponse

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
          reponse = fabriquer()
          cookiesToSet.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options))
        },
      },
    }
  )
  try {
    await avecTimeout(supabase.auth.getUser())
  } catch {
    // Supabase lent : la page s'affiche quand même, la session sera
    // rafraîchie à la prochaine.
  }
  return reponse
}

export async function proxy(request: NextRequest) {
  // Tout en haut : sur sonoo.app, Vercel et localhost, rien ne change.
  const hote = request.headers.get('host')
  if (!estHotePlateforme(hote)) return reponseDomaineBoutique(request, hoteSansPort(hote))

  if (estHoteSonoo(hote)) {
    const redirection = await redirectionVersDomaine(request)
    if (redirection) return redirection
  }

  // Avant tout appel à Supabase : une page fermée sans autorisation n'a pas
  // besoin de vérifier la session.
  if (maintenanceActive() && cheminFermeEnMaintenance(request.nextUrl.pathname)) {
    const autorise = await jetonMaintenanceValide(request.cookies.get(COOKIE_MAINTENANCE)?.value)
    if (!autorise) {
      const url = request.nextUrl.clone()
      url.pathname = '/maintenance'
      url.search = ''
      const retour = request.nextUrl.pathname + request.nextUrl.search
      if (retour !== '/') url.searchParams.set('next', retour)
      return NextResponse.redirect(url)
    }
  }

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
      url.search = ''
      url.searchParams.set('redirect', pathname)
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

    // Étape 8b — gate abonnement plateforme, étendu en Phase 12 lot 2 (plan
    // Free). Le compte admin et les boutiques de test exemptées
    // (`abonnement_exempte`, laisser-passer admin) ne sont jamais bloqués.
    // `/dashboard/abonnement` reste toujours accessible pour permettre de
    // souscrire. Sans abonnement actif, un beatmaker n'est plus totalement
    // bloqué (comportement d'origine de l'Étape 8b) : il garde un accès
    // PARTIEL, limité aux pages du plan Free (lib/acces-plan.ts) — seule une
    // page hors de cette liste redirige encore vers /dashboard/abonnement.
    const gateExempte = estRoleAdmin(beatmaker.role) || beatmaker.abonnement_exempte
    if (!gateExempte && pathname !== '/dashboard/abonnement' && pathname !== '/dashboard/suspendu') {
      let abonnementActif = false
      try {
        abonnementActif = await avecTimeout(aUnAbonnementPlateformeActif(supabase, beatmaker.id))
      } catch {
        return versVerificationEnCours()
      }

      if (!abonnementActif && !pageAccessibleEnPlanFree(pathname)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/abonnement'
        return NextResponse.redirect(url)
      }
    }
  }

  // Pages auth beatmaker — redirige vers /dashboard si déjà connecté en tant que beatmaker
  if ((pathname === '/connexion' || pathname === '/inscription') && user) {
    const url = request.nextUrl.clone()
    const retour = request.nextUrl.searchParams.get('redirect')
    url.search = ''
    url.pathname = retour && retour.startsWith('/dashboard') && !retour.startsWith('//') ? retour : '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
