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
  ventes: number
  ca: number           // en centimes
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

  const [{ data: blRows }, { data: cmdRows }] = beatIds.length > 0
    ? await Promise.all([
        admin
          .from('beat_licences')
          .select('beat_id, licences(modele)')
          .in('beat_id', beatIds)
          .eq('actif', true),
        admin
          .from('commandes')
          .select('beat_id, prix_paye')
          .eq('beatmaker_id', user.id)
          .eq('statut', 'payee')
          .not('beat_id', 'is', null),
      ])
    : [{ data: [] as unknown[] }, { data: [] as unknown[] }]

  // Map beat_id → licences modeles actifs
  type BlRow = { beat_id: string; licences: { modele: string } | null }
  const licencesMap = new Map<string, string[]>()
  for (const bl of (blRows ?? []) as BlRow[]) {
    if (!bl.beat_id || !bl.licences?.modele) continue
    if (!licencesMap.has(bl.beat_id)) licencesMap.set(bl.beat_id, [])
    licencesMap.get(bl.beat_id)!.push(bl.licences.modele)
  }

  // Map beat_id → { ventes, ca }
  type CmdRow = { beat_id: string | null; prix_paye: number }
  const statsMap = new Map<string, { ventes: number; ca: number }>()
  for (const cmd of (cmdRows ?? []) as CmdRow[]) {
    if (!cmd.beat_id) continue
    const cur = statsMap.get(cmd.beat_id) ?? { ventes: 0, ca: 0 }
    statsMap.set(cmd.beat_id, { ventes: cur.ventes + 1, ca: cur.ca + (cmd.prix_paye ?? 0) })
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
    ventes:        statsMap.get(b.id as string)?.ventes ?? 0,
    ca:            statsMap.get(b.id as string)?.ca ?? 0,
  }))

  return <BeatsClient beats={beats} />
}
