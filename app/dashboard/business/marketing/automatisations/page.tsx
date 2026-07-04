import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AutomatisationsClient from './_components/AutomatisationsClient'

export type AutomatisationRow = {
  id: string
  type: string
  actif: boolean
  objet: string | null
  corps: string | null
  delai_minutes: number
}

export default async function AutomatisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data } = await supabase
    .from('automatisations')
    .select('id, type, actif, objet, corps, delai_minutes')
    .eq('beatmaker_id', user.id)

  async function sauvegarder(type: string, actif: boolean, objet: string, corps: string, delaiMinutes: number) {
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
      delai_minutes: delaiMinutes > 0 ? delaiMinutes : 1440,
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
