import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
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

  // Résumé des fonds en attente (splits collab pas encore transférés) — pour
  // que le bouton de déblocage ne soit pas un geste aveugle (audit 2026-07-29,
  // suite F4 : aucune visibilité n'existait avant sur /dashboard/paiements).
  const admin = createAdminClient()
  const { data: pendants } = await admin
    .from('split_payments')
    .select('montant')
    .eq('beatmaker_id', user.id)
    .eq('statut', 'en_attente')

  const fondsEnAttenteCount = pendants?.length ?? 0
  const fondsEnAttenteTotal = (pendants ?? []).reduce((s, p) => s + p.montant, 0) / 100

  return (
    <PaiementsClient
      stripeAccountId={beatmaker?.stripe_account_id ?? null}
      tvaActive={beatmaker?.tva_active ?? false}
      tvaTaux={beatmaker?.tva_taux ?? 20}
      tvaNumero={beatmaker?.tva_numero ?? ''}
      fondsEnAttenteCount={fondsEnAttenteCount}
      fondsEnAttenteTotal={fondsEnAttenteTotal}
    />
  )
}
