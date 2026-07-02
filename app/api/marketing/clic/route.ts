import { verifierTokenCampagne, incrementerCompteurCampagne, COOKIE_CLIC, FENETRE_CONVERSION_JOURS } from '@/lib/mailing'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-producer.com'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const token = params.get('token')
  const urlCible = params.get('url')

  // Protection open-redirect : on ne redirige jamais en dehors de notre propre domaine
  const destination = urlCible && urlCible.startsWith(APP_URL) ? urlCible : APP_URL

  const verif = token ? verifierTokenCampagne(token) : null
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
