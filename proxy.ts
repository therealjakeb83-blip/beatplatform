import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { estRoleAdmin } from '@/lib/admin'
import { aUnAbonnementPlateformeActif, pageAccessibleEnPlanFree } from '@/lib/acces-plan'
import { COOKIE_MAINTENANCE, cheminFermeEnMaintenance, jetonMaintenanceValide, maintenanceActive } from '@/lib/maintenance'
import { DOMAINE_PLATEFORME, SOUS_DOMAINES_OUVERTS, URL_APP } from '@/lib/constantes'
import { CHEMIN_SONDE, SIGNATURE_SONDE, estHotePlateforme, estHoteSonoo, etiquetteSousDomaine, hoteSansPort, hoteSousDomaine, routeSurDomaine, slugDuChemin } from '@/lib/domaine-boutique'
import { estSlugReserve, sousDomainePossible } from '@/lib/slug-regles'
import { createAdminClient } from '@/utils/supabase/admin'
import { etatBoutique, MESSAGE_BOUTIQUE_INDISPONIBLE, type AbonnementPlateformeResume, type BeatmakerVisibilite } from '@/lib/boutique-visible'

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
// `domaineActif` : sur un sous-domaine seulement, le domaine perso actif de la
// boutique, vers lequel ses pages renvoient (adresse officielle, décision 3A).
type BoutiqueDuDomaine = { slug: string | null; visible: boolean; domaineActif?: string | null }
const memoireDomaines = new Map<string, BoutiqueDuDomaine & { expire: number }>()
const memoireRedirections = new Map<string, { domaine: string | null; expire: number }>()

type LigneDomaine = { domaine: string; statut: string }

function domaineActifDe(lignes: LigneDomaine | LigneDomaine[] | null | undefined): string | null {
  const liste = Array.isArray(lignes) ? lignes : lignes ? [lignes] : []
  return liste.find(l => l.statut === 'actif')?.domaine ?? null
}

// Adresse officielle d'une boutique demandée sur sonoo.app/slug : son domaine
// actif, sinon (sous-domaines ouverts, rang 9c bis) slug.sonoo.app.
async function destinationDuSlug(slug: string): Promise<string | null> {
  const memorise = memoireRedirections.get(slug)
  if (memorise && memorise.expire > Date.now()) return memorise.domaine

  const { data, error } = await avecTimeout(
    createAdminClient()
      .from('beatmakers')
      .select('slug, domaines_boutique(domaine, statut)')
      .eq('slug', slug)
      .maybeSingle()
  )
  if (error) throw error

  const actif = data ? domaineActifDe(data.domaines_boutique as unknown as LigneDomaine | LigneDomaine[] | null) : null
  const domaine = actif ?? (data && SOUS_DOMAINES_OUVERTS && sousDomainePossible(slug) ? hoteSousDomaine(slug) : null)
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
    domaine = await destinationDuSlug(slug)
  } catch {
    return null
  }
  if (!domaine) return null
  return NextResponse.redirect(`https://${domaine}${pathname.slice(slug.length + 1)}${search}`, 307)
}

async function boutiqueDuDomaine(hote: string): Promise<BoutiqueDuDomaine> {
  const memorise = memoireDomaines.get(hote)
  if (memorise && memorise.expire > Date.now()) return memorise

  const { data, error } = await avecTimeout(
    createAdminClient()
      .from('domaines_boutique')
      .select('beatmakers(slug, role, abonnement_exempte, statut, abonnements_plateforme(statut, date_annulation, date_fin))')
      .eq('domaine', hote)
      .eq('statut', 'actif')
      .maybeSingle()
  )
  if (error) throw error

  const beatmaker = data?.beatmakers as unknown as
    | (BeatmakerVisibilite & { slug: string | null; abonnements_plateforme: AbonnementPlateformeResume[] | null })
    | null
    | undefined
  const resultat: BoutiqueDuDomaine = {
    slug: beatmaker?.slug ?? null,
    visible: !!beatmaker && etatBoutique(beatmaker, beatmaker.abonnements_plateforme ?? []).visible,
  }
  if (memoireDomaines.size >= MEMOIRE_MAX_ENTREES) memoireDomaines.clear()
  memoireDomaines.set(hote, { ...resultat, expire: Date.now() + MEMOIRE_DOMAINE_MS })
  return resultat
}

type BeatmakerSousDomaine = BeatmakerVisibilite & {
  slug: string
  abonnements_plateforme: AbonnementPlateformeResume[] | null
  domaines_boutique: LigneDomaine | LigneDomaine[] | null
}

// Rang 9c bis : boutique de slug.sonoo.app, retrouvée par son slug (aucune ligne
// à créer). Mot réservé (mail, admin…) = aucune boutique, sans lire la base.
async function boutiqueDuSousDomaine(etiquette: string): Promise<BoutiqueDuDomaine> {
  if (estSlugReserve(etiquette)) return { slug: null, visible: false }
  const cle = `sous-domaine:${etiquette}`
  const memorise = memoireDomaines.get(cle)
  if (memorise && memorise.expire > Date.now()) return memorise

  const { data, error } = await avecTimeout(
    createAdminClient()
      .from('beatmakers')
      .select('slug, role, abonnement_exempte, statut, abonnements_plateforme(statut, date_annulation, date_fin), domaines_boutique(domaine, statut)')
      .eq('slug', etiquette)
      .maybeSingle()
  )
  if (error) throw error

  const beatmaker = data as unknown as BeatmakerSousDomaine | null
  const resultat: BoutiqueDuDomaine = beatmaker
    ? {
        slug: beatmaker.slug,
        visible: etatBoutique(beatmaker, beatmaker.abonnements_plateforme ?? []).visible,
        domaineActif: domaineActifDe(beatmaker.domaines_boutique),
      }
    : { slug: null, visible: false }
  if (memoireDomaines.size >= MEMOIRE_MAX_ENTREES) memoireDomaines.clear()
  memoireDomaines.set(cle, { ...resultat, expire: Date.now() + MEMOIRE_DOMAINE_MS })
  return resultat
}

// Sous-domaine qui n'a jamais été une boutique (décision 7A) : comme un domaine inconnu.
const PAGE_AUCUNE_BOUTIQUE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Aucune boutique</title><style>html,body{margin:0;height:100%;background:#05060B;color:#9ca3af;font-family:system-ui,-apple-system,sans-serif}body{display:flex;align-items:center;justify-content:center;padding:0 16px;text-align:center}</style></head><body><p>Aucune boutique à cette adresse.</p></body></html>`

function reponseAucuneBoutique(): NextResponse {
  return new NextResponse(PAGE_AUCUNE_BOUTIQUE, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

// Domaine sans boutique à montrer (abonnement arrêté, impayé, suspension,
// domaine pas actif ou plus rattaché) : jamais de 404 ni de redirection. 503 =
// « temporaire » pour les moteurs de recherche.
const PAGE_INDISPONIBLE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Boutique indisponible</title><style>html,body{margin:0;height:100%;background:#05060B;color:#9ca3af;font-family:system-ui,-apple-system,sans-serif}body{display:flex;align-items:center;justify-content:center;padding:0 16px;text-align:center}</style></head><body><p>${MESSAGE_BOUTIQUE_INDISPONIBLE}</p></body></html>`

function reponseIndisponible(): NextResponse {
  return new NextResponse(PAGE_INDISPONIBLE, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '3600' },
  })
}

async function reponseDomaineBoutique(request: NextRequest, hote: string) {
  if (request.nextUrl.pathname === CHEMIN_SONDE) {
    return NextResponse.json({ sonoo: SIGNATURE_SONDE }, { headers: { 'cache-control': 'no-store' } })
  }

  const etiquette = etiquetteSousDomaine(hote)
  let boutique: BoutiqueDuDomaine
  try {
    boutique = etiquette === null ? await boutiqueDuDomaine(hote) : await boutiqueDuSousDomaine(etiquette)
  } catch {
    return new NextResponse('Cette boutique est momentanément injoignable. Réessaie dans un instant.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '10' },
    })
  }
  const slug = boutique.slug
  if (!slug) return etiquette === null && !hote.endsWith(`.${DOMAINE_PLATEFORME}`) ? reponseIndisponible() : reponseAucuneBoutique()

  const { pathname, search } = request.nextUrl
  const route = routeSurDomaine(pathname)
  if (route === 'plateforme') return NextResponse.redirect(new URL(pathname + search, URL_APP))
  // Sous-domaine d'une boutique qui a son domaine actif : ses pages y renvoient,
  // comme sonoo.app/slug (temporaire : si le domaine tombe, le sous-domaine
  // réaffiche la boutique). Paiement et téléchargements restent servis ici.
  if (boutique.domaineActif && route === 'boutique' && (request.method === 'GET' || request.method === 'HEAD')) {
    return NextResponse.redirect(`https://${boutique.domaineActif}${pathname}${search}`, 307)
  }
  // Téléchargements des achats passés, désinscription, connexion : toujours servis.
  if (route === 'direct') return avecSessionRafraichie(request, () => NextResponse.next({ request }))
  if (!boutique.visible) return reponseIndisponible()

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
