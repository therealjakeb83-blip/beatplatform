import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { etatTentativeMulti, type EtatPaiement } from '@/lib/paiement-multi'
import { cookieAccesTelechargement, DUREE_COOKIE_ACCES } from '@/lib/telechargement-acces'

export const runtime = 'nodejs'

// Phase 13, lot 2 — la page a été rechargée pendant un paiement (voir
// app/[slug]/_lib/paiement-en-cours.ts) : où en est-il ? Sert à ne jamais
// réafficher un panier plein pour un paiement déjà parti (double paiement).
// L'identifiant Stripe (PaymentIntent ou SetupIntent), connu seulement du
// navigateur qui a payé, prouve le droit d'accéder à la commande — comme
// /api/telechargement/lookup.
export async function POST(request: Request) {
  const { type, id, annuler } = await request.json() as { type?: 'solo' | 'multi'; id?: string; annuler?: boolean }
  if (!id || (type !== 'solo' && type !== 'multi')) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })

  const etat = type === 'multi'
    ? await etatTentativeMulti(id, annuler === true)
    : await etatPaiementSolo(id, annuler === true)

  if (etat.etat === 'termine') {
    const cookieStore = await cookies()
    cookieStore.set(cookieAccesTelechargement(etat.commandeId), '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: DUREE_COOKIE_ACCES,
      path: `/telechargement/${etat.commandeId}`,
      sameSite: 'lax',
    })
    return NextResponse.json({ etat: 'termine', commande_id: etat.commandeId })
  }
  return NextResponse.json(etat)
}

async function etatPaiementSolo(paymentIntentId: string, annuler: boolean): Promise<EtatPaiement> {
  const admin = createAdminClient()
  const { data: commande } = await admin.from('commandes').select('id').eq('stripe_payment_id', paymentIntentId).maybeSingle()
  if (commande) {
    // Terminée seulement quand tous les beats et contrats sont prêts (voir
    // /api/telechargement/lookup) ; sinon encore « en cours ».
    const { data: terminee } = await admin
      .from('tentatives_paiement').select('id')
      .eq('commande_id', commande.id).eq('statut', 'complete').limit(1).maybeSingle()
    return terminee ? { etat: 'termine', commandeId: commande.id as string } : { etat: 'en_cours', paye: true }
  }

  const { data: tentative } = await admin
    .from('tentatives_paiement').select('beatmaker_id')
    .eq('stripe_payment_intent_id', paymentIntentId).eq('type', 'achat_express').maybeSingle()
  if (!tentative) return { etat: 'abandonne' }
  const { data: beatmaker } = await admin.from('beatmakers').select('stripe_account_id').eq('id', tentative.beatmaker_id).maybeSingle()
  const options = beatmaker?.stripe_account_id ? { stripeAccount: beatmaker.stripe_account_id as string } : undefined

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {}, options)
    // Débité (ou en passe de l'être) : la commande arrive par le webhook.
    if (pi.status === 'succeeded' || pi.status === 'processing' || pi.status === 'requires_capture') return { etat: 'en_cours', paye: true }
    if (pi.status === 'canceled') return { etat: 'abandonne' }
    // Jamais confirmé, ou fenêtre de validation perdue avec la page : on
    // l'annule pour qu'il ne puisse plus aboutir derrière un nouveau paiement.
    if (!annuler) return { etat: 'interrompu' }
    await stripe.paymentIntents.cancel(paymentIntentId, {}, options)
    return { etat: 'abandonne' }
  } catch (err) {
    // Annulation refusée = il vient d'aboutir : on laisse le webhook finir.
    console.error('[etat-paiement] Lecture/annulation impossible', paymentIntentId, err instanceof Error ? err.message : err)
    return { etat: 'en_cours', paye: false }
  }
}
