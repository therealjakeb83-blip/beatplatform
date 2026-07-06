import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PlansClient from './_components/PlansClient'

export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('abo_actif, abo_nom, abo_description, abo_prix, abo_remise_pct, abo_recurrence_cadeau_mois, stripe_price_id')
    .eq('id', user.id)
    .single()

  const plan = {
    abo_actif:       beatmaker?.abo_actif       ?? false,
    abo_nom:         beatmaker?.abo_nom         ?? null,
    abo_description: beatmaker?.abo_description ?? null,
    abo_prix:        beatmaker?.abo_prix        ?? null,
    abo_remise_pct:  beatmaker?.abo_remise_pct  ?? 30,
    abo_recurrence_cadeau_mois: beatmaker?.abo_recurrence_cadeau_mois ?? 4,
    stripe_price_id: beatmaker?.stripe_price_id ?? null,
  }

  return <PlansClient plan={plan} />
}
