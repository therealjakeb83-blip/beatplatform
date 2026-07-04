import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AutomatisationsClient from './_components/AutomatisationsClient'

export type AutomatisationRow = {
  id: string
  type: string
  actif: boolean
  objet: string | null
  corps: string | null
  delai_heures: number
  heure_cible_minutes: number | null
}

export default async function AutomatisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data } = await supabase
    .from('automatisations')
    .select('id, type, actif, objet, corps, delai_heures, heure_cible_minutes')
    .eq('beatmaker_id', user.id)

  async function sauvegarder(
    type: string, actif: boolean, objet: string, corps: string,
    delaiHeures: number, heureCibleMinutes: number | null,
  ) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('automatisations').upsert({
      beatmaker_id: user.id,
      type,
      actif,
      objet: objet.trim() || null,
      corps: corps.trim() || null,
      delai_heures: delaiHeures >= 0 ? delaiHeures : 10,
      heure_cible_minutes: heureCibleMinutes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'beatmaker_id,type' })
  }

  return (
    <AutomatisationsClient
      automatisations={(data ?? []) as AutomatisationRow[]}
      sauvegarder={sauvegarder}
    />
  )
}
