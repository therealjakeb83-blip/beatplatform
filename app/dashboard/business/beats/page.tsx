import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import BeatsClient from './_components/BeatsClient'

export type BeatRow = {
  id: string
  titre: string
  bpm: number | null
  cle: string | null
  statut: string
  image_url: string | null
  couleur: string | null
  created_at: string
  styles: string[] | null
  type_beat: string[] | null
  mp3_tague_url: string | null
  licences: string[]   // modeles actifs : 'mp3' | 'wav' | 'stems' | 'illimite' | 'exclusive'
}

export default async function BeatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: rawBeats } = await admin
    .from('beats')
    .select('id, titre, bpm, cle, statut, image_url, couleur, created_at, styles, type_beat, mp3_tague_url')
    .eq('beatmaker_id', user.id)
    .is('supprime_le', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const beatIds = (rawBeats ?? []).map(b => b.id as string)

  const [{ data: blRows }, { data: licRows }] = beatIds.length > 0
    ? await Promise.all([
        // Récupère toutes les lignes beat_licences actives pour ces beats
        admin
          .from('beat_licences')
          .select('beat_id, licence_id')
          .in('beat_id', beatIds)
          .eq('actif', true),
        // Récupère les licences du beatmaker (id → modele)
        admin
          .from('licences')
          .select('id, modele')
          .eq('beatmaker_id', user.id),
      ])
    : [{ data: [] as unknown[] }, { data: [] as unknown[] }]

  // Map licence_id → modele
  type LicRow = { id: string; modele: string }
  const modeleMap = new Map<string, string>()
  for (const l of (licRows ?? []) as LicRow[]) {
    modeleMap.set(l.id, l.modele)
  }

  // Map beat_id → modeles actifs
  type BlRow = { beat_id: string; licence_id: string }
  const licencesMap = new Map<string, string[]>()
  for (const bl of (blRows ?? []) as BlRow[]) {
    const modele = modeleMap.get(bl.licence_id)
    if (!modele) continue
    if (!licencesMap.has(bl.beat_id)) licencesMap.set(bl.beat_id, [])
    licencesMap.get(bl.beat_id)!.push(modele)
  }

  const beats: BeatRow[] = (rawBeats ?? []).map(b => ({
    id:            b.id as string,
    titre:         b.titre as string,
    bpm:           b.bpm as number | null,
    cle:           b.cle as string | null,
    statut:        b.statut as string,
    image_url:     b.image_url as string | null,
    couleur:       (b as { couleur?: string | null }).couleur ?? null,
    created_at:    b.created_at as string,
    styles:        b.styles as string[] | null,
    type_beat:     b.type_beat as string[] | null,
    mp3_tague_url: b.mp3_tague_url as string | null,
    licences:      licencesMap.get(b.id as string) ?? [],
  }))

  return <BeatsClient beats={beats} />
}
