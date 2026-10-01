import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerAbonnementGratuitDepuisCarte } from '@/lib/abonnement-boutique'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// 1er mois offert (code promo 100 %) : la carte vient d'être enregistrée sur
// le compte du beatmaker, on crée l'abonnement avec elle. Rejouable sans
// risque (clé d'idempotence = SetupIntent) : un double clic ou un rechargement
// ne crée jamais deux abonnements.
export async function POST(request: Request) {
  const { slug, setup_intent_id } = await request.json() as { slug?: string; setup_intent_id?: string }
  if (!slug || !setup_intent_id?.startsWith('seti_')) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })

  const { data: beatmaker } = await createAdminClient().from('beatmakers').select('stripe_account_id').eq('slug', slug).maybeSingle()
  if (!beatmaker?.stripe_account_id) return NextResponse.json({ erreur: 'Boutique introuvable' }, { status: 404 })
  const stripeAccount = beatmaker.stripe_account_id as string

  try {
    const setupIntent = await stripe.setupIntents.retrieve(setup_intent_id, {}, { stripeAccount })
    if (setupIntent.status !== 'succeeded' || setupIntent.metadata?.type !== 'abonnement_boutique_carte' || setupIntent.metadata?.slug !== slug) {
      return NextResponse.json({ erreur: 'Carte non enregistrée' }, { status: 400 })
    }
    const subscriptionId = await creerAbonnementGratuitDepuisCarte(stripeAccount, setupIntent)
    return NextResponse.json({ subscription_id: subscriptionId })
  } catch (err) {
    console.error('[abonnement/finaliser]', setup_intent_id, err instanceof Error ? err.message : err)
    return NextResponse.json({ erreur: 'Impossible de démarrer l\'abonnement, réessaie.' }, { status: 500 })
  }
}
