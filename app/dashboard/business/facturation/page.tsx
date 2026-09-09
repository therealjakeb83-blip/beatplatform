import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import FacturationClient from './FacturationClient'

export default async function FacturationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('slug, mandat_facturation_version, mandat_facturation_accepte_at, facturation_format, facturation_offset, facturation_annee_courante, facturation_compteur')
    .eq('id', user.id)
    .single()

  return (
    <FacturationClient
      slug={beatmaker?.slug ?? ''}
      mandatVersion={beatmaker?.mandat_facturation_version ?? null}
      mandatAccepteLe={beatmaker?.mandat_facturation_accepte_at ?? null}
      formatPersonnalise={beatmaker?.facturation_format ?? null}
      offset={beatmaker?.facturation_offset ?? null}
      anneeCourante={beatmaker?.facturation_annee_courante ?? null}
      dernierNumero={beatmaker?.facturation_compteur ?? null}
    />
  )
}
