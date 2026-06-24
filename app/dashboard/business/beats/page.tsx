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
  if (beatIds.length === 0) return <BeatsClient beats={[]} />

  const [{ data: blRows }, { data: licRows }] = await Promise.all([
    // Récupère toutes les lignes beat_licences pour ces beats (filtrage actif en JS)
    admin
      .from('beat_licences')
      .select('beat_id, licence_id, actif')
      .in('beat_id', beatIds),
    // Récupère les licences ACTIVES du beatmaker (id → modele)
    admin
      .from('licences')
      .select('id, modele')
      .eq('beatmaker_id', user.id)
      .eq('actif', true),
  ])

  type LicRow = { id: string; modele: string }
  type BlRow  = { beat_id: string; licence_id: string; actif: boolean }

  // Map licence_id → modele
  const modeleMap = new Map<string, string>()
  for (const l of (licRows ?? []) as LicRow[]) modeleMap.set(l.id, l.modele)

  // Beats ayant AU MOINS une entrée beat_licences = configurés
  const beatsConfigures = new Set<string>()
  for (const bl of (blRows ?? []) as BlRow[]) beatsConfigures.add(bl.beat_id)

  // --- Migration silencieuse : initialise beat_licences pour les vieux beats ---
  const beatsNonConfigures = beatIds.filter(id => !beatsConfigures.has(id))
  if (beatsNonConfigures.length > 0 && (licRows ?? []).length > 0) {
    const entries = beatsNonConfigures.flatMap(beatId =>
      (licRows as LicRow[]).map(l => ({
        beat_id:       beatId,
        licence_id:    l.id,
        actif:         true,
        prix_override: null,
        sur_demande:   false,
      }))
    )
    await admin
      .from('beat_licences')
      .upsert(entries, { onConflict: 'beat_id,licence_id' })
    // Les nouveaux beats sont maintenant configurés avec toutes licences actives
    for (const id of beatsNonConfigures) beatsConfigures.add(id)
  }
  // -------------------------------------------------------------------------

  // Map beat_id → modeles actifs (filtrage actif en JS pour éviter l'ambiguïté Supabase)
  const licencesMap = new Map<string, string[]>()
  for (const bl of (blRows ?? []) as BlRow[]) {
    if (!bl.actif) continue
    const modele = modeleMap.get(bl.licence_id)
    if (!modele) continue
    if (!licencesMap.has(bl.beat_id)) licencesMap.set(bl.beat_id, [])
    licencesMap.get(bl.beat_id)!.push(modele)
  }
  // Beats nouvellement migrés : toutes les licences actives
  for (const id of beatsNonConfigures) {
    licencesMap.set(id, (licRows as LicRow[]).map(l => l.modele))
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
