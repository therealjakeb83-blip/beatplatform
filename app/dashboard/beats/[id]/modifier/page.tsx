import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ModifierBeatClient from './ModifierBeatClient'

export default async function ModifierBeatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beat } = await supabase
    .from('beats')
    .select('*')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .is('supprime_le', null)
    .single()

  if (!beat) notFound()

  const { data: splitsRaw } = await supabase
    .from('beat_splits')
    .select('id, beatmaker_id, email_invite, pourcentage, statut, beatmakers(nom_artiste)')
    .eq('beat_id', id)

  const splits = (splitsRaw ?? []).map(s => ({
    ...s,
    beatmakers: Array.isArray(s.beatmakers) ? (s.beatmakers[0] ?? null) : s.beatmakers,
  }))

  return <ModifierBeatClient beat={beat} splits={splits ?? []} />
}
