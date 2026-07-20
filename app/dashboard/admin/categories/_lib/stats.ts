import type { TypeCategorie } from '@/lib/categories'

export type StatsCategorie = { nb_beats: number; ventes: number; ca_net: number; ecoutes: number }

const STATS_VIDES: StatsCategorie = { nb_beats: 0, ventes: 0, ca_net: 0, ecoutes: 0 }

type BeatTags = { id: string; styles: string[] | null; ambiances: string[] | null; instruments: string[] | null; type_beat: string[] | null }
type LigneVente = { beat_id: string; prix_paye: number; reduction_montant: number | null }
type PlayRow = { beat_id: string }

const COLONNES_TAGS: { type: TypeCategorie; get: (b: BeatTags) => string[] | null }[] = [
  { type: 'styles', get: b => b.styles },
  { type: 'ambiances', get: b => b.ambiances },
  { type: 'instruments', get: b => b.instruments },
  { type: 'type_beat', get: b => b.type_beat },
]

// Regroupe par (type, nom) plutôt que par beatmaker_id : une demande de
// certification porte sur un nom de tag, et savoir combien de beats
// (tous beatmakers confondus) portent déjà ce nom donne un signal de
// popularité plus utile pour décider qu'une vue limitée au seul demandeur.
export function agregerStatsParCategorie(
  beats: BeatTags[],
  lignes: LigneVente[],
  plays: PlayRow[],
): Map<string, StatsCategorie> {
  const parBeat = new Map<string, { ventes: number; ca_net: number; ecoutes: number }>()

  for (const l of lignes) {
    const cur = parBeat.get(l.beat_id) ?? { ventes: 0, ca_net: 0, ecoutes: 0 }
    cur.ventes += 1
    cur.ca_net += l.prix_paye - (l.reduction_montant ?? 0)
    parBeat.set(l.beat_id, cur)
  }
  for (const p of plays) {
    const cur = parBeat.get(p.beat_id) ?? { ventes: 0, ca_net: 0, ecoutes: 0 }
    cur.ecoutes += 1
    parBeat.set(p.beat_id, cur)
  }

  const parTag = new Map<string, StatsCategorie>()
  for (const b of beats) {
    const beatStats = parBeat.get(b.id) ?? { ventes: 0, ca_net: 0, ecoutes: 0 }
    for (const { type, get } of COLONNES_TAGS) {
      for (const nom of get(b) ?? []) {
        const cle = `${type}|${nom}`
        const cur = parTag.get(cle) ?? { ...STATS_VIDES }
        cur.nb_beats += 1
        cur.ventes += beatStats.ventes
        cur.ca_net += beatStats.ca_net
        cur.ecoutes += beatStats.ecoutes
        parTag.set(cle, cur)
      }
    }
  }

  return parTag
}

export function statsPour(map: Map<string, StatsCategorie>, type: TypeCategorie, nom: string): StatsCategorie {
  return map.get(`${type}|${nom}`) ?? STATS_VIDES
}
