import { createAdminClient } from '@/utils/supabase/admin'
import { cookieAccesTelechargement, DUREE_COOKIE_ACCES } from '@/lib/telechargement-acces'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const paymentIntentId = searchParams.get('payment_intent')

  if (!sessionId && !paymentIntentId) {
    return NextResponse.json({ erreur: 'session_id ou payment_intent manquant' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const query = supabase.from('commandes').select('id')

  const { data } = sessionId
    ? await query.eq('stripe_session_id', sessionId).maybeSingle()
    : await query.eq('stripe_payment_id', paymentIntentId).maybeSingle()

  if (!data) {
    return NextResponse.json({ erreur: 'Commande introuvable' }, { status: 404 })
  }

  // La commande existe dès le début de sa création, mais ses beats et
  // contrats sont ajoutés un par un ensuite : la page de téléchargement ne
  // s'ouvre qu'une fois TOUT prêt (tentative marquée « complete » en toute fin
  // de finaliserCommandePayee) — sinon un panier de plusieurs beats pouvait
  // s'afficher incomplet (vu en test, Phase 13 lot 3). L'appelant réessaie.
  const { data: terminee } = await supabase
    .from('tentatives_paiement')
    .select('id')
    .eq('commande_id', data.id)
    .eq('statut', 'complete')
    .limit(1)
    .maybeSingle()
  if (!terminee) {
    return NextResponse.json({ en_cours: true }, { status: 202 })
  }

  // Accès direct à la page de téléchargement (Phase 11, 9 bis) — ce lookup
  // n'est atteignable qu'avec un session_id/payment_intent Stripe légitime,
  // qui prouve déjà le paiement : pas besoin de reconfirmer l'email.
  const cookieStore = await cookies()
  cookieStore.set(cookieAccesTelechargement(data.id), '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: DUREE_COOKIE_ACCES,
    path: `/telechargement/${data.id}`,
    sameSite: 'lax',
  })

  return NextResponse.json({ commande_id: data.id })
}
