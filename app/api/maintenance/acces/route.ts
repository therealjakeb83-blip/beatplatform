import { NextResponse } from 'next/server'
import {
  COOKIE_MAINTENANCE,
  DUREE_ACCES_MAINTENANCE_S,
  creerJetonMaintenance,
  motDePasseMaintenanceCorrect,
  retourSur,
} from '@/lib/maintenance'

export async function POST(request: Request) {
  const form = await request.formData()
  const saisi = String(form.get('mot_de_passe') ?? '')
  const next = retourSur(String(form.get('next') ?? ''))

  if (!motDePasseMaintenanceCorrect(saisi)) {
    // Ralentit les essais à la chaîne.
    await new Promise(r => setTimeout(r, 1000))
    const url = new URL('/maintenance', request.url)
    url.searchParams.set('erreur', '1')
    if (next !== '/') url.searchParams.set('next', next)
    return NextResponse.redirect(url, { status: 303 })
  }

  const jeton = await creerJetonMaintenance()
  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 })
  if (jeton) {
    response.cookies.set(COOKIE_MAINTENANCE, jeton, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DUREE_ACCES_MAINTENANCE_S,
    })
  }
  return response
}
