import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PaiementsClient from './PaiementsClient'

export default async function PaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id, tva_active, tva_taux, tva_numero')
    .eq('id', user.id)
    .single()

  return (
    <PaiementsClient
      stripeAccountId={beatmaker?.stripe_account_id ?? null}
      tvaActive={beatmaker?.tva_active ?? false}
      tvaTaux={beatmaker?.tva_taux ?? 20}
      tvaNumero={beatmaker?.tva_numero ?? ''}
    />
  )
}
