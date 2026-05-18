import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import AbonnementsClient from './AbonnementsClient'

export default async function AbonnementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id, abo_actif, abo_nom, abo_description, abo_prix, abo_remise_pct, abo_essai_jours, stripe_price_id')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()
  const { data: abonnes } = await admin
    .from('abonnements_boutique')
    .select('id, acheteur_email, acheteur_nom, statut, en_essai, date_debut, stripe_subscription_id')
    .eq('beatmaker_id', user.id)
    .order('date_debut', { ascending: false })

  const plan = {
    abo_actif: beatmaker?.abo_actif ?? false,
    abo_nom: beatmaker?.abo_nom ?? null,
    abo_description: beatmaker?.abo_description ?? null,
    abo_prix: beatmaker?.abo_prix ?? null,
    abo_remise_pct: beatmaker?.abo_remise_pct ?? 30,
    abo_essai_jours: beatmaker?.abo_essai_jours ?? 30,
    stripe_price_id: beatmaker?.stripe_price_id ?? null,
  }

  return <AbonnementsClient plan={plan} abonnes={abonnes ?? []} />
}
