import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { aAccesPlanPayant } from '@/lib/acces-plan'
import { chargerGroupesTitres } from '@/lib/import-externe/liens-beats'
import RelierBeatsClient from '../_components/RelierBeatsClient'

// Relier les titres des commandes importées au catalogue (import lot 3).
// Plan Free : page visible, actions verrouillées (décision 21).
export default async function RelierBeatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  // Client admin : les beats supprimés doivent rester lisibles (choisissables
  // à la main) ; tout est filtré sur le beatmaker connecté.
  const [planPayant, { groupes, beats }] = await Promise.all([
    aAccesPlanPayant(supabase, user.id),
    chargerGroupesTitres(createAdminClient(), user.id),
  ])

  return <RelierBeatsClient groupes={groupes} beats={beats} planPayant={planPayant} />
}
