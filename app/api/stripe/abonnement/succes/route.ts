import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const slug = searchParams.get('slug')

  if (!sessionId || !slug) {
    return NextResponse.redirect(`${origin}/`)
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    const email = session.customer_details?.email
    const nom = session.customer_details?.name ?? null
    let clientId = session.metadata?.client_id || null

    if (email && session.metadata?.beatmaker_id) {
      const sub = session.subscription as import('stripe').Stripe.Subscription | null
      const supabase = createAdminClient()

      const { data: beatmaker } = await supabase
        .from('beatmakers')
        .select('abo_prix')
        .eq('id', session.metadata.beatmaker_id)
        .single()

      // Résolution client par email — même logique que le webhook checkout,
      // nécessaire pour que l'automatisation "Bienvenue abonnement" ait un
      // destinataire même pour un abonné invité (non connecté au checkout)
      if (!clientId) {
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (existingClient) {
          clientId = existingClient.id
        } else {
          const parts = (nom ?? '').trim().split(' ')
          const prenom = parts[0] || null
          const nomFamille = parts.slice(1).join(' ') || parts[0] || email.split('@')[0]
          const { data: newClient } = await supabase
            .from('clients')
            .insert({ id: crypto.randomUUID(), email, nom: nomFamille, prenom })
            .select('id')
            .single()
          clientId = newClient?.id ?? null
        }
      }

      const enEssai = sub?.status === 'trialing'
      const essaiFinLe = sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
      const dateDebut = new Date().toISOString()
      const dateFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: abonnement } = await supabase.from('abonnements_boutique').insert({
        beatmaker_id: session.metadata.beatmaker_id,
        client_id: clientId || null,
        acheteur_email: email,
        acheteur_nom: nom,
        plan: 'standard',
        periode: 'mensuel',
        prix: beatmaker?.abo_prix ?? 0,
        devise: 'EUR',
        statut: 'actif',
        methode_paiement: 'stripe',
        stripe_subscription_id: sub?.id ?? null,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        en_essai: enEssai,
        essai_fin_le: essaiFinLe,
        date_debut: dateDebut,
        date_fin: dateFin,
      }).select('id').single()

      if (abonnement && clientId) {
        const { error: evenementError } = await supabase.from('automatisation_evenements').insert({
          beatmaker_id: session.metadata.beatmaker_id,
          client_id: clientId,
          type: 'bienvenue_abonnement',
          reference_id: abonnement.id,
        })
        if (evenementError) console.error('[abo/succes] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
      }

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
