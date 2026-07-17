import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { chargerOptionsCategories } from '@/lib/categories'
import NouveauBeatClient from './NouveauBeatClient'

export default async function NouveauBeatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: licences }, categories] = await Promise.all([
    supabase
      .from('licences')
      .select('id, nom, prix, modele, inclut_mp3, inclut_wav, inclut_stems, est_exclusive, streams_limite')
      .eq('beatmaker_id', user.id)
      .eq('actif', true)
      .order('ordre'),
    chargerOptionsCategories(supabase),
  ])

  const beatId = crypto.randomUUID()

  return <NouveauBeatClient beatId={beatId} licences={licences ?? []} categories={categories} />
}
