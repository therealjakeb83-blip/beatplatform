import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LicencesClient from './_components/LicencesClient'

const LICENCES_DEFAUT = [
  { ordre: 1, nom: 'MP3 Basic',   prix: 25,  modele: 'mp3',       inclut_mp3: true, inclut_wav: false, inclut_stems: false, est_exclusive: false, streams_limite: 50000,  vues_video_limite: 200000, clips_video_limite: 1, radio_tv_limite: 1 },
  { ordre: 2, nom: 'MP3 + WAV',   prix: 45,  modele: 'wav',       inclut_mp3: true, inclut_wav: true,  inclut_stems: false, est_exclusive: false, streams_limite: 100000, vues_video_limite: 500000, clips_video_limite: 2, radio_tv_limite: 2 },
  { ordre: 3, nom: 'WAV + Stems', prix: 75,  modele: 'stems',     inclut_mp3: true, inclut_wav: true,  inclut_stems: true,  est_exclusive: false, streams_limite: null,   vues_video_limite: null,   clips_video_limite: null, radio_tv_limite: null },
  { ordre: 4, nom: 'Illimité',    prix: 150, modele: 'illimite',  inclut_mp3: true, inclut_wav: true,  inclut_stems: true,  est_exclusive: false, streams_limite: null,   vues_video_limite: null,   clips_video_limite: null, radio_tv_limite: null },
  { ordre: 5, nom: 'Exclusive',   prix: 500, modele: 'exclusive', inclut_mp3: true, inclut_wav: true,  inclut_stems: true,  est_exclusive: true,  streams_limite: null,   vues_video_limite: null,   clips_video_limite: null, radio_tv_limite: null },
]

export default async function LicencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  let { data: licences } = await admin
    .from('licences')
    .select('*')
    .eq('beatmaker_id', user.id)
    .order('ordre')

  if (!licences || licences.length === 0) {
    await admin.from('licences').insert(
      LICENCES_DEFAUT.map(l => ({ ...l, beatmaker_id: user.id }))
    )
    const { data } = await admin.from('licences').select('*').eq('beatmaker_id', user.id).order('ordre')
    licences = data ?? []
  }

  return <LicencesClient licences={licences ?? []} />
}
