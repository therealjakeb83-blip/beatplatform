import { stripe } from '@/lib/stripe'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Cette route ne sert qu'à l'expérience utilisateur (poser le cookie de session
// membre + rediriger) — jamais à créer l'abonnement en base. Cette redirection
// dépend du navigateur du client (peut être lente, interrompue, ou ne jamais
// arriver si l'onglet est fermé), donc pas fiable pour une action critique.
// La création réelle de la ligne abonnements_boutique se fait dans le webhook
// Stripe (checkout.session.completed → traiterAbonnementCree), qui est garanti
// serveur à serveur, indépendamment de ce que fait le navigateur.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const slug = searchParams.get('slug')

  if (!sessionId || !slug) {
    return NextResponse.redirect(`${origin}/`)
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const email = session.customer_details?.email

    if (email) {
      const cookieStore = await cookies()
      cookieStore.set(`abo_${slug}`, email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      })
    }
  } catch (err) {
    console.error('[abo/succes]', err)
  }

  return NextResponse.redirect(`${origin}/${slug}/mon-abonnement`)
}
