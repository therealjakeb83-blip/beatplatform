import { verifierTokenCampagne, incrementerCompteurCampagne, lienDuSite, COOKIE_CLIC, FENETRE_CONVERSION_JOURS } from '@/lib/mailing'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { URL_APP } from '@/lib/constantes'
import { domaineActifDeLaBoutique } from '@/lib/boutique-du-domaine'

export const runtime = 'nodejs'

const APP_URL = URL_APP

// Protection open-redirect : seulement sonoo.app, ou le domaine actif de la
// boutique qui a envoyé l'email (jamais celui d'une autre boutique).
async function destinationAutorisee(urlCible: string | null, beatmakerId: string | null): Promise<string> {
  if (!urlCible) return APP_URL
  if (lienDuSite(urlCible, APP_URL)) return urlCible
  const domaine = beatmakerId ? await domaineActifDeLaBoutique(beatmakerId).catch(() => null) : null
  if (domaine && lienDuSite(urlCible, `https://${domaine}`)) return urlCible
  return domaine ? `https://${domaine}` : APP_URL
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const token = params.get('token')
  const urlCible = params.get('url')

  const verif = token ? verifierTokenCampagne(token) : null
  const destination = await destinationAutorisee(urlCible, verif?.beatmakerId ?? null)
  if (!verif || !token) return NextResponse.redirect(destination)

  const admin = createAdminClient()
  const { clientId, campagneId } = verif

  const { data: envoi } = await admin
    .from('campagne_envois')
    .select('id, clique_at')
    .eq('campagne_id', campagneId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (envoi && !envoi.clique_at) {
    await admin.from('campagne_envois').update({ clique_at: new Date().toISOString() }).eq('id', envoi.id)
    await incrementerCompteurCampagne(campagneId, 'clics')
  }

  const response = NextResponse.redirect(destination)
  response.cookies.set(COOKIE_CLIC, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: FENETRE_CONVERSION_JOURS * 86_400,
  })
  return response
}
