import { stripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single()

  if (!beatmaker?.stripe_account_id) {
    return NextResponse.json({ erreur: 'Compte Stripe non connecté' }, { status: 400 })
  }

  const { data: pending } = await admin
    .from('split_payments')
    .select('id, montant, commandes(stripe_transfer_group, beats(titre))')
    .eq('beatmaker_id', user.id)
    .eq('statut', 'en_attente')

  if (!pending?.length) return NextResponse.json({ debloques: 0 })

  type PendingSplit = {
    id: string
    montant: number
    commandes: { stripe_transfer_group: string | null; beats: { titre: string } | null } | null
  }

  let debloques = 0

  for (const sp of pending as unknown as PendingSplit[]) {
    const transferGroup = sp.commandes?.stripe_transfer_group
    const titreBeat = sp.commandes?.beats?.titre ?? 'Beat'
    if (!transferGroup) continue

    try {
      const transfer = await stripe.transfers.create({
        amount: sp.montant,
        currency: 'eur',
        destination: beatmaker.stripe_account_id!,
        transfer_group: transferGroup,
        description: `Déblocage split — ${titreBeat} — sp ${sp.id}`,
      })

      await admin
        .from('split_payments')
        .update({ statut: 'transfere', stripe_transfer_id: transfer.id })
        .eq('id', sp.id)

      debloques++
    } catch {
      // Transfer échoué silencieusement (balance insuffisante, etc.)
    }
  }

  return NextResponse.json({ debloques })
}
