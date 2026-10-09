import type { TypeCategorie } from '@/lib/categories'

export type StatsCategorie = { nb_beats: number; ventes: number; ca_net: number; ecoutes: number }

const STATS_VIDES: StatsCategorie = { nb_beats: 0, ventes: 0, ca_net: 0, ecoutes: 0 }

type BeatTags = { id: string; styles: string[] | null; ambiances: string[] | null; instruments: string[] | null; type_beat: string[] | null }
// Une ligne = une vente du beat ; ca_net = HT, déjà ramené aux règles d'Analytics
// (parts, remboursements, litiges, TVA de chaque vendeur) par l'appelant.
export type LigneVente = { beat_id: string; ca_net: number }

const COLONNES_TAGS: { type: TypeCategorie; get: (b: BeatTags) => string[] | null }[] = [
  { type: 'styles', get: b => b.styles },
  { type: 'ambiances', get: b => b.ambiances },
  { type: 'instruments', get: b => b.instruments },
  { type: 'type_beat', get: b => b.type_beat },
]

// Regroupe par (type, nom) plutôt que par beatmaker_id : une demande de
// certification porte sur un nom de tag, et savoir combien de beats portent
// déjà ce nom donne un signal utile pour décider. Utilisé à la fois par
// l'admin (scope plateforme-wide) et par la page business (scope propre
// beatmaker) — seule la requête SQL en amont diffère, pas cette agrégation.
export function agregerStatsParCategorie(
  beats: BeatTags[],
  lignes: LigneVente[],
  // Écoutes par beat, comptées dans la base (supabase/analytics_agregats.sql)
  ecoutesParBeat: Map<string, number>,
): Map<string, StatsCategorie> {
  const parBeat = new Map<string, { ventes: number; ca_net: number; ecoutes: number }>()

  for (const l of lignes) {
    const cur = parBeat.get(l.beat_id) ?? { ventes: 0, ca_net: 0, ecoutes: 0 }
    cur.ventes += 1
    cur.ca_net += l.ca_net
    parBeat.set(l.beat_id, cur)
  }
  for (const [beatId, n] of ecoutesParBeat) {
    const cur = parBeat.get(beatId) ?? { ventes: 0, ca_net: 0, ecoutes: 0 }
    cur.ecoutes += n
    parBeat.set(beatId, cur)
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
