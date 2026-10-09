import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import BeatsClient from './_components/BeatsClient'
import { parLots, toutesLesLignes } from '../_lib/requetes'

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
  mis_en_avant: boolean
  hors_vente_collab: boolean
  // Pourquoi le beat est hors vente, pour distinguer le badge (Phase 12, lot
  // 3, retour de Jake du 2026-09-28) : une invitation encore en attente n'a
  // rien à voir avec une collaboration refusée qu'A n'a pas encore "publiée
  // quand même". Tous acceptés (lot 4) : 'prete' si tous les vendeurs sont
  // prêts à vendre (le beat n'attend plus que l'ouverture des ventes collab),
  // sinon 'action_moi' (A doit finir sa configuration) ou 'action_collab'
  // (un collaborateur n'est plus éligible aux paiements).
  collabBadge: 'attente' | 'refusee' | 'prete' | 'action_moi' | 'action_collab' | null
}

export default async function BeatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  // Tout le catalogue, sans plafond (ancien .limit(500)) — paginé à l'affichage
  const rawBeats = await toutesLesLignes((debut, fin) => admin
    .from('beats')
    .select('id, titre, bpm, cle, statut, image_url, couleur, created_at, styles, type_beat, mp3_tague_url, mis_en_avant, hors_vente_collab')
    .eq('beatmaker_id', user.id)
    .is('supprime_le', null)
    .order('created_at', { ascending: false })
    .order('id')
    .range(debut, fin))

  const idsHorsVente = (rawBeats ?? [])
    .filter(b => (b as Record<string, unknown>).hors_vente_collab)
    .map(b => b.id as string)

  const collabBadgeParBeat = new Map<string, NonNullable<BeatRow['collabBadge']>>()
  if (idsHorsVente.length > 0) {
    const [splits, { data: moi }] = await Promise.all([
      parLots(idsHorsVente, lot => admin
        .from('beat_splits')
        .select('beat_id, statut, beatmakers(pret_a_vendre_collaborateur)')
        .in('beat_id', lot)
        .in('statut', ['invitee', 'active', 'refusee'])),

      admin.from('beatmakers').select('pret_a_vendre_concedant').eq('id', user.id).maybeSingle(),
    ])

    type SplitBadge = { beat_id: string; statut: string; beatmakers: { pret_a_vendre_collaborateur: boolean } | { pret_a_vendre_collaborateur: boolean }[] | null }
    const parBeat = new Map<string, SplitBadge[]>()
    for (const s of (splits ?? []) as unknown as SplitBadge[]) {
      parBeat.set(s.beat_id, [...(parBeat.get(s.beat_id) ?? []), s])
    }
    for (const [beatId, lignes] of parBeat) {
      const statuts = lignes.map(l => l.statut)
      const collaborateurPasPret = lignes.some(l => {
        const bm = Array.isArray(l.beatmakers) ? l.beatmakers[0] : l.beatmakers
        return l.statut === 'active' && !bm?.pret_a_vendre_collaborateur
      })
      if (statuts.includes('invitee')) collabBadgeParBeat.set(beatId, 'attente')
      else if (statuts.includes('refusee')) collabBadgeParBeat.set(beatId, 'refusee')
      else if (!moi?.pret_a_vendre_concedant) collabBadgeParBeat.set(beatId, 'action_moi')
      else if (collaborateurPasPret) collabBadgeParBeat.set(beatId, 'action_collab')
      else collabBadgeParBeat.set(beatId, 'prete')
    }
  }

  const beats: BeatRow[] = (rawBeats ?? []).map(b => ({
    id:            b.id as string,
    titre:         b.titre as string,
    bpm:           b.bpm as number | null,
    cle:           b.cle as string | null,
    statut:        b.statut as string,
    image_url:     b.image_url as string | null,
    couleur:       (b as Record<string, unknown>).couleur as string | null ?? null,
    created_at:    b.created_at as string,
    styles:        b.styles as string[] | null,
    type_beat:     b.type_beat as string[] | null,
    mp3_tague_url: b.mp3_tague_url as string | null,
    mis_en_avant:  (b as Record<string, unknown>).mis_en_avant as boolean ?? false,
    hors_vente_collab: (b as Record<string, unknown>).hors_vente_collab as boolean ?? false,
    collabBadge: collabBadgeParBeat.get(b.id as string) ?? null,
  }))

  return <BeatsClient beats={beats} />
}
