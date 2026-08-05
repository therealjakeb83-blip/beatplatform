import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ReductionsLotClient from './_components/ReductionsLotClient'

export type ReductionLotRow = {
  id: string
  licence_id: string
  nom: string
  nb_a_acheter: number
  nb_offerts: number
  actif: boolean
  created_at: string
}

export type LicenceOption = { id: string; nom: string; modele: string }

export default async function ReductionsLotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const [{ data: rawRegles }, { data: rawLicences }] = await Promise.all([
    admin.from('reductions_lot').select('*').eq('beatmaker_id', user.id).order('created_at', { ascending: false }),
    admin.from('licences').select('id, nom, modele').eq('beatmaker_id', user.id).eq('actif', true).order('ordre'),
  ])

  return (
    <ReductionsLotClient
      regles={(rawRegles ?? []) as ReductionLotRow[]}
      licences={(rawLicences ?? []) as LicenceOption[]}
    />
  )
}
