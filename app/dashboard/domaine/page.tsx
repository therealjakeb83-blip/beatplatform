import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { aAccesPlanPayant } from '@/lib/acces-plan'
import { createAdminClient } from '@/utils/supabase/admin'
import { avertissementDomaineIndisponible, chargerEtatBoutique } from '@/lib/boutique-visible'
import { COLONNES_DOMAINE } from '@/lib/domaines-boutique-serveur'
import type { DomaineBoutique } from '@/lib/domaine-regles'
import DomaineClient from './DomaineClient'

export default async function DomainePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: beatmaker }, { data: domaine }, planPayant, etat] = await Promise.all([
    supabase.from('beatmakers').select('slug').eq('id', user.id).single(),
    supabase.from('domaines_boutique').select(COLONNES_DOMAINE).eq('beatmaker_id', user.id).maybeSingle(),
    aAccesPlanPayant(supabase, user.id),
    chargerEtatBoutique(createAdminClient(), user.id),
  ])
  const ligne = domaine as unknown as DomaineBoutique | null

  return (
    <DomaineClient
      domaineInitial={ligne}
      avertissementIndisponible={ligne ? avertissementDomaineIndisponible(etat, ligne.domaine) : null}
      planPayant={planPayant}
      slug={beatmaker?.slug ?? ''}
    />
  )
}
