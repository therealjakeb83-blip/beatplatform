import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AbonnementPlateformeClient from './_components/AbonnementPlateformeClient'

export default async function AbonnementPlateformePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: abo } = await supabase
    .from('abonnements_plateforme')
    .select('id, statut, en_essai, essai_fin_le, periode, prix, devise, date_fin, stripe_customer_id')
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return <AbonnementPlateformeClient abonnement={abo} />
}
