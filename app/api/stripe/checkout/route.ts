import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const { beat_id, licence_id, slug } = await request.json()

  if (!beat_id || !licence_id || !slug) {
    return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: beat } = await supabase
    .from('beats')
    .select('id, titre, image_url, beatmaker_id, beatmakers(stripe_account_id, tva_active, tva_taux)')
    .eq('id', beat_id)
    .eq('statut', 'public')
    .is('supprime_le', null)
    .single()

  if (!beat) return NextResponse.json({ erreur: 'Beat introuvable' }, { status: 404 })

  const { data: beatLicence } = await supabase
    .from('beat_licences')
    .select('actif, prix_override, sur_demande, licences(id, nom, prix, actif)')
    .eq('beat_id', beat_id)
    .eq('licence_id', licence_id)
    .single()

  if (!beatLicence?.actif || beatLicence.sur_demande) {
    return NextResponse.json({ erreur: 'Licence indisponible' }, { status: 400 })
  }

  type LicenceRow = { id: string; nom: string; prix: number; actif: boolean }
  const licence = beatLicence.licences as unknown as LicenceRow
  if (!licence?.actif) return NextResponse.json({ erreur: 'Licence inactive' }, { status: 400 })

  type BeatmakerRow = { stripe_account_id: string | null; tva_active: boolean; tva_taux: number | null }
  const beatmaker = (beat as unknown as { beatmakers: BeatmakerRow }).beatmakers

  const prixHT = (beatLicence.prix_override ?? licence.prix) * 100
  const tvaMultiplier = beatmaker.tva_active && beatmaker.tva_taux ? beatmaker.tva_taux / 100 : 0
  const prixTotal = Math.round(prixHT * (1 + tvaMultiplier))

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${beat.titre} — ${licence.nom}`,
          ...(beat.image_url ? { images: [beat.image_url] } : {}),
        },
        unit_amount: prixTotal,
      },
      quantity: 1,
    }],
    billing_address_collection: 'required',
    allow_promotion_codes: true,
    success_url: `${origin}/${slug}/${beat_id}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${slug}/${beat_id}`,
    metadata: {
      beat_id,
      licence_id,
      beatmaker_id: String(beat.beatmaker_id),
      slug,
      prix_ht: String(prixHT),
    },
  }

  if (beatmaker.stripe_account_id) {
    sessionParams.payment_intent_data = {
      application_fee_amount: 0,
      on_behalf_of: beatmaker.stripe_account_id,
      transfer_data: { destination: beatmaker.stripe_account_id },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  return NextResponse.json({ url: session.url })
}
