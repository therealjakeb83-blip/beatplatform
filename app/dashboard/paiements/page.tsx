import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PaiementsClient from './PaiementsClient'

export default async function PaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('stripe_account_id, fulfillment_mandat_version, fulfillment_mandat_accepte_at, fulfillment_mandat_revoque_at, moyens_paiement_acceptes, statement_descriptor')
    .eq('id', user.id)
    .single()

  // Mandat actif = accepté, et pas révoqué depuis (une révocation suivie
  // d'une nouvelle acceptation remet le mandat actif — accepter écrit
  // toujours revoque_at:null, donc la seule combinaison "accepté mais
  // révoqué" possible est un vrai état révoqué).
  const mandatFulfillmentActif = !!beatmaker?.fulfillment_mandat_accepte_at && !beatmaker?.fulfillment_mandat_revoque_at

  return (
    <PaiementsClient
      stripeAccountId={beatmaker?.stripe_account_id ?? null}
      mandatFulfillmentActif={mandatFulfillmentActif}
      mandatFulfillmentVersion={beatmaker?.fulfillment_mandat_version ?? null}
      mandatFulfillmentAccepteLe={beatmaker?.fulfillment_mandat_accepte_at ?? null}
      moyensPaiementAcceptes={beatmaker?.moyens_paiement_acceptes ?? ['carte']}
      statementDescriptor={beatmaker?.statement_descriptor ?? ''}
    />
  )
}
