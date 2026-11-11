import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { URL_APP } from '@/lib/constantes'
import { cheminInterne } from '@/lib/redirection'
import { estHotePlateforme, hoteSansPort } from '@/lib/domaine-boutique'

export const runtime = 'nodejs'

// « Continuer avec Google » pour les clients artistes (rang 9c, lot 4). Toujours
// lancé depuis sonoo.app : Supabase n'accepte pas « tous les domaines » comme
// adresse de retour. `domaine` = site de la boutique d'où vient le client, revérifié
// au retour (seul un domaine Actif reçoit le laissez-passer).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (!estHotePlateforme(request.headers.get('host'))) {
    return NextResponse.redirect(new URL(`/api/artiste/google?${params}`, URL_APP), 303)
  }

  const retour = new URL('/api/artiste/google/retour', URL_APP)
  retour.searchParams.set('redirect', cheminInterne(params.get('redirect'), '/mon-compte'))
  const domaine = hoteSansPort(params.get('domaine'))
  if (domaine && !estHotePlateforme(domaine)) retour.searchParams.set('domaine', domaine)

  const { data, error } = await (await createClient()).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: retour.toString(), skipBrowserRedirect: true },
  })
  if (error || !data?.url) {
    console.error('[artiste/google] signInWithOAuth:', JSON.stringify(error))
    return NextResponse.redirect(new URL(`/artiste/connexion?erreur=google&redirect=${encodeURIComponent(retour.searchParams.get('redirect')!)}`, URL_APP), 303)
  }
  return NextResponse.redirect(data.url, 303)
}
