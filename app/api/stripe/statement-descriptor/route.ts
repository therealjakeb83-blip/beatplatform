import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { validerStatementDescriptor } from '@/lib/statement-descriptor'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { statement_descriptor } = await request.json() as { statement_descriptor?: string }
  const descripteur = (statement_descriptor ?? '').trim()

  const validation = validerStatementDescriptor(descripteur)
  if (!validation.ok) return NextResponse.json({ erreur: validation.erreur }, { status: 400 })

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single()

  // Compte Stripe pas encore connecté : on sauvegarde côté My Producer, le
  // descriptor sera poussé vers Stripe une fois le compte créé (connect/creer
  // le fait déjà pour un nouveau compte — pas encore le cas pour un compte
  // déjà connecté avant que ce descriptor n'existe, à revoir si besoin).
  if (beatmaker?.stripe_account_id) {
    try {
      await stripe.accounts.update(beatmaker.stripe_account_id, {
        settings: { payments: { statement_descriptor: descripteur } },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur Stripe inconnue'
      return NextResponse.json({ erreur: message }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('beatmakers')
    .update({ statement_descriptor: descripteur })
    .eq('id', user.id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
