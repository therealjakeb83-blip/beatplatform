import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AbonnementPlateformeClient from './_components/AbonnementPlateformeClient'

export default async function AbonnementPlateformePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: abo } = await supabase
    .from('abonnements_plateforme')
    .select('id, statut, en_essai, essai_fin_le, periode, prix, devise, date_fin, stripe_customer_id, annulation_prevue_le')
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Historique des échecs de paiement (rang 9 ROADMAP) — table dormante tant
  // que supabase/tentatives_paiement_plateforme.sql n'est pas exécutée.
  const { data: echecs } = abo
    ? await supabase
        .from('tentatives_paiement')
        .select('id, created_at, prix')
        .eq('abonnement_plateforme_id', abo.id)
        .order('created_at', { ascending: false })
    : { data: null }

  return <AbonnementPlateformeClient abonnement={abo} echecsPaiement={echecs ?? []} />
}
