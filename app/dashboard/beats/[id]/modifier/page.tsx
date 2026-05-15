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

  const [{ data: licences }, { data: beatLicences }] = await Promise.all([
    supabase
      .from('licences')
      .select('id, nom, prix, modele, inclut_mp3, inclut_wav, inclut_stems, est_exclusive, streams_limite')
      .eq('beatmaker_id', user.id)
      .eq('actif', true)
      .order('ordre'),
    supabase
      .from('beat_licences')
      .select('licence_id, actif, prix_override, sur_demande')
      .eq('beat_id', id),
  ])

  const licencesActives = (licences ?? [])
    .filter(l => {
      const bl = (beatLicences ?? []).find(x => x.licence_id === l.id)
      return bl ? bl.actif : true
    })
    .map(l => l.id)

  const exclusifLicence = (licences ?? []).find(l => l.modele === 'exclusive')
  const exclusifBeatLicence = exclusifLicence
    ? (beatLicences ?? []).find(x => x.licence_id === exclusifLicence.id)
    : null

  return (
    <ModifierBeatClient
      beat={beat}
      splits={splits ?? []}
      licences={licences ?? []}
      licencesActives={licencesActives}
      exclusifSurDemande={exclusifBeatLicence?.sur_demande ?? false}
      exclusifPrixOverride={exclusifBeatLicence?.prix_override ? String(exclusifBeatLicence.prix_override) : ''}
    />
  )
}
