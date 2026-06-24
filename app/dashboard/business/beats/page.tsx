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
    .select('id, titre, bpm, cle, statut, image_url, couleur, created_at, styles, type_beat, mp3_tague_url, mp3_propre_url, wav_url, stems_url')
    .eq('beatmaker_id', user.id)
    .is('supprime_le', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const beatIds = (rawBeats ?? []).map(b => b.id as string)

  const [{ data: blRows }, { data: licRows }] = beatIds.length > 0
    ? await Promise.all([
        // Récupère toutes les lignes beat_licences pour ces beats (filtrage actif en JS)
        admin
          .from('beat_licences')
          .select('beat_id, licence_id, actif')
          .in('beat_id', beatIds),
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

  // Map beat_id → modeles actifs (filtrage actif en JS pour éviter l'ambiguïté Supabase)
  type BlRow = { beat_id: string; licence_id: string; actif: boolean }
  const licencesMap = new Map<string, string[]>()
  // Set des beats ayant AU MOINS une entrée dans beat_licences (même inactive)
  const beatsAvecBl = new Set<string>()
  for (const bl of (blRows ?? []) as BlRow[]) {
    beatsAvecBl.add(bl.beat_id)
    if (!bl.actif) continue
    const modele = modeleMap.get(bl.licence_id)
    if (!modele) continue
    if (!licencesMap.has(bl.beat_id)) licencesMap.set(bl.beat_id, [])
    licencesMap.get(bl.beat_id)!.push(modele)
  }

  // Modeles actifs du beatmaker (pour le fallback des vieux beats)
  const modelesActifs = ((licRows ?? []) as LicRow[]).map(l => l.modele)

  // Fallback pour beats sans entrées beat_licences : déduit des fichiers disponibles
  type RawBeat = { mp3_propre_url?: unknown; wav_url?: unknown; stems_url?: unknown }
  function getLicencesFallback(b: RawBeat): string[] {
    const hasMp3 = !!b.mp3_propre_url
    const hasWav  = !!b.wav_url
    const hasStems = !!b.stems_url
    return modelesActifs.filter(m => {
      switch (m) {
        case 'mp3':      return hasMp3
        case 'wav':      return hasMp3 && hasWav
        case 'stems':
        case 'illimite':
        case 'exclusive': return hasMp3 && hasWav && hasStems
        default:          return false
      }
    })
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
    licences:      beatsAvecBl.has(b.id as string)
                     ? (licencesMap.get(b.id as string) ?? [])
                     : getLicencesFallback(b),
  }))

  return <BeatsClient beats={beats} />
}
