import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { payerTentativeMulti } from '@/lib/paiement-multi'
import { cookieAccesTelechargement, DUREE_COOKIE_ACCES } from '@/lib/telechargement-acces'

export const runtime = 'nodejs'
// Réservation + encaissement de chaque part, puis création de la commande
// (contrats PDF, email) : plus long qu'un paiement solo.
export const maxDuration = 60

// Paiement réparti (Phase 13, lot 1) — étape 2 : la carte vient d'être
// enregistrée par le navigateur (SetupIntent confirmé). Le SetupIntent
// confirmé prouve à lui seul le droit d'accéder à la commande créée.
export async function POST(request: Request) {
  const { setup_intent_id } = await request.json() as { setup_intent_id?: string }
  if (!setup_intent_id) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })

  const resultat = await payerTentativeMulti(setup_intent_id)
  if (!resultat.ok && resultat.validation) return NextResponse.json({ validation: resultat.validation })
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur }, { status: resultat.status })

  const cookieStore = await cookies()
  cookieStore.set(cookieAccesTelechargement(resultat.commandeId), '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: DUREE_COOKIE_ACCES,
    path: `/telechargement/${resultat.commandeId}`,
    sameSite: 'lax',
  })
  return NextResponse.json({ commande_id: resultat.commandeId })
}
