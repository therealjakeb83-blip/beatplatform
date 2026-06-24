import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

function licenceDisponible(modele: string, f: { mp3_propre_url: string | null; wav_url: string | null; stems_url: string | null }): boolean {
  switch (modele) {
    case 'mp3':       return !!f.mp3_propre_url
    case 'wav':       return !!f.mp3_propre_url && !!f.wav_url
    case 'stems':
    case 'illimite':
    case 'exclusive': return !!f.mp3_propre_url && !!f.wav_url && !!f.stems_url
    default:          return false
  }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: beats }, { data: licences }] = await Promise.all([
    admin
      .from('beats')
      .select('id, mp3_propre_url, wav_url, stems_url')
      .eq('beatmaker_id', user.id)
      .is('supprime_le', null),
    admin
      .from('licences')
      .select('id, modele')
      .eq('beatmaker_id', user.id)
      .eq('actif', true),
  ])

  if (!beats?.length || !licences?.length) return Response.json({ reset: 0 })

  type Licence = { id: string; modele: string }
  type Beat    = { id: string; mp3_propre_url: string | null; wav_url: string | null; stems_url: string | null }

  const entries = (beats as Beat[]).flatMap(beat =>
    (licences as Licence[]).map(l => ({
      beat_id:       beat.id,
      licence_id:    l.id,
      actif:         licenceDisponible(l.modele, beat),
      prix_override: null,
      sur_demande:   false,
    }))
  )

  const { error } = await admin
    .from('beat_licences')
    .upsert(entries, { onConflict: 'beat_id,licence_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ reset: entries.length })
}
