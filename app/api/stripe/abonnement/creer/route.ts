import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreClientId } from '@/lib/pricing'
import { normaliserEmail } from '@/lib/email'
import {
  assurerCouponAbonnement, assurerProduitAbonnement, creerAbonnementAPayer, preparerAbonnement, type MetadataAbonnement,
} from '@/lib/abonnement-boutique'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Abonnement boutique en paiement direct : client, produit, coupon et
// abonnement sont créés sur le compte Stripe du beatmaker. Le navigateur
// confirme ensuite le paiement (ou l'enregistrement de la carte si le 1er
// mois est offert). Rien n'est enregistré chez nous avant que Stripe confirme
// (webhook des comptes vendeurs, lib/abonnement-boutique-webhook.ts).
export async function POST(request: Request) {
  const body = await request.json() as {
    slug?: string
    code_promo?: string
    email_acheteur?: string
    prenom?: string
    nom?: string
    telephone?: string
    adresse?: string
    code_postal?: string
    ville?: string
    pays?: string
    type_client?: 'particulier' | 'professionnel'
    raison_sociale?: string
    numero_tva?: string
    newsletter_opt_in?: boolean
    source_marketing?: string
  }
  if (!body.slug) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const preparation = await preparerAbonnement(admin, body.slug, user, body.code_promo, body.email_acheteur)
  if (!preparation.ok) return NextResponse.json({ erreur: preparation.erreur }, { status: preparation.status })
  const { beatmaker, promo, prixCents, premierCents, emailCompte } = preparation.value

  const email = emailCompte ?? (body.email_acheteur ? normaliserEmail(body.email_acheteur) : null)
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ erreur: 'Email invalide' }, { status: 400 })

  const stripeAccount = beatmaker.stripe_account_id
  const options = { stripeAccount }
  const nomComplet = [body.prenom, body.nom].map(s => s?.trim()).filter(Boolean).join(' ') || null
  const pro = body.type_client === 'professionnel'
  const coupe = (v: string | null | undefined, n = 200) => (v ?? '').trim().slice(0, n)

  try {
    const [produitId, couponId] = await Promise.all([
      assurerProduitAbonnement(admin, beatmaker),
      promo ? assurerCouponAbonnement(promo, stripeAccount) : Promise.resolve(null),
    ])

    const client = await stripe.customers.create({
      email,
      name: nomComplet ?? undefined,
      phone: coupe(body.telephone, 40) || undefined,
      ...(body.adresse ? {
        address: { line1: coupe(body.adresse), postal_code: coupe(body.code_postal, 20), city: coupe(body.ville, 100), country: coupe(body.pays, 2) || undefined },
      } : {}),
    }, options)

    const clientId = await resoudreClientId(admin, user)
    const metadata: MetadataAbonnement = {
      type: 'abonnement_boutique',
      beatmaker_id: beatmaker.id,
      slug: beatmaker.slug,
      client_id: clientId ?? '',
      email,
      prenom: coupe(body.prenom, 100),
      nom: coupe(body.nom, 100),
      telephone: coupe(body.telephone, 40),
      adresse: coupe(body.adresse),
      code_postal: coupe(body.code_postal, 20),
      ville: coupe(body.ville, 100),
      pays: coupe(body.pays, 2),
      newsletter_opt_in: body.newsletter_opt_in === true ? 'true' : 'false',
      source_marketing: coupe(body.source_marketing, 50) || 'direct',
      code_promo: promo?.code ?? '',
      prix_cents: String(prixCents),
      ...(pro && body.raison_sociale?.trim() ? { acheteur_raison_sociale: coupe(body.raison_sociale) } : {}),
      ...(pro && body.numero_tva?.trim() ? { acheteur_numero_tva: coupe(body.numero_tva, 32).toUpperCase() } : {}),
    }

    if (premierCents === 0) {
      const setupIntent = await stripe.setupIntents.create({
        customer: client.id,
        payment_method_types: ['card', 'link'],
        usage: 'off_session',
        metadata: { ...metadata, type: 'abonnement_boutique_carte', produit_id: produitId, coupon_id: couponId ?? '' },
      }, options)
      return NextResponse.json({ type: 'carte', clientSecret: setupIntent.client_secret, id: setupIntent.id })
    }

    const { subscriptionId, clientSecret } = await creerAbonnementAPayer({
      stripeAccount, customerId: client.id, produitId, prixCents, couponId, premierCentsAttendu: premierCents, metadata,
    })
    return NextResponse.json({ type: 'paiement', clientSecret, id: subscriptionId })
  } catch (err) {
    console.error('[abonnement/creer]', body.slug, err instanceof Error ? err.message : err)
    return NextResponse.json({ erreur: 'Impossible de préparer l\'abonnement, réessaie.' }, { status: 500 })
  }
}
