import type { SupabaseClient } from '@supabase/supabase-js'
import { toutesLesLignes } from '@/app/dashboard/business/_lib/requetes'
import { dayKeyInTz } from '@/lib/fuseau-horaire'
import type { HistoriqueSlot } from '@/app/dashboard/business/analytics/_lib/periode'

// Écoutes, free downloads et favoris comptés DANS la base (supabase/analytics_agregats.sql) :
// lus ligne par ligne, ils étaient coupés à 1 000 par Supabase sans message.
// Même au-delà, une RPC renvoie elle aussi au plus 1 000 lignes → lecture par pages.

export type EvenementsBeat = { ecoutes: number; duree_somme: number; duree_nb: number; free_dl: number; favoris: number }

type LigneBeat = EvenementsBeat & { beat_id: string }
type LigneTranche = { tranche: string; beat_id: string | null; ecoutes: number; free_dl: number; favoris: number }

// Les bornes de période arrivent en ISO ou en 'YYYY-MM-DD' (période personnalisée) :
// même instant que la comparaison de texte de inPeriod().
const instant = (d: string | null) => (d ? new Date(d).toISOString() : null)

/** Totaux par beat sur la période (bornes incluses, null = sans borne — comme inPeriod). */
export async function evenementsParBeat(
  admin: SupabaseClient,
  beatmakerId: string,
  from: string | null,
  to: string | null,
): Promise<Map<string, EvenementsBeat>> {
  const lignes = await toutesLesLignes<LigneBeat>((debut, fin) =>
    admin.rpc('analytics_evenements_par_beat', { p_beatmaker_id: beatmakerId, p_de: instant(from), p_a: instant(to) })
      .order('beat_id')
      .range(debut, fin),
  )
  return new Map(lignes.map(l => [l.beat_id, {
    ecoutes: Number(l.ecoutes), duree_somme: Number(l.duree_somme), duree_nb: Number(l.duree_nb),
    free_dl: Number(l.free_dl), favoris: Number(l.favoris),
  }]))
}

export function totalEvenements(parBeat: Map<string, EvenementsBeat>): EvenementsBeat {
  const t: EvenementsBeat = { ecoutes: 0, duree_somme: 0, duree_nb: 0, free_dl: 0, favoris: 0 }
  for (const e of parBeat.values()) {
    t.ecoutes += e.ecoutes; t.duree_somme += e.duree_somme; t.duree_nb += e.duree_nb
    t.free_dl += e.free_dl; t.favoris += e.favoris
  }
  return t
}

export type EvenementsTranche = { beat_id: string | null; ecoutes: number; free_dl: number; favoris: number }

/** Comptes par tranche du graphique : résultat[i] = lignes du slot i (une seule
 *  ligne beat_id null si parBeat = false). Les slots commencent tous à un
 *  minuit local (jour, lundi, 1er du mois) = la tranche calculée par la base. */
export async function evenementsParTranche(
  admin: SupabaseClient,
  beatmakerId: string,
  tz: string,
  granularite: 'jours' | 'semaines' | 'mois',
  slots: HistoriqueSlot[],
  parBeat: boolean,
): Promise<EvenementsTranche[][]> {
  if (!slots.length) return []
  const lignes = await toutesLesLignes<LigneTranche>((debut, fin) =>
    admin.rpc('analytics_evenements_par_tranche', {
      p_beatmaker_id: beatmakerId, p_fuseau: tz, p_granularite: granularite,
      p_de: slots[0].from, p_a: slots[slots.length - 1].to, p_par_beat: parBeat,
    })
      .order('tranche')
      .order('beat_id')
      .range(debut, fin),
  )
  const parTranche = new Map<string, EvenementsTranche[]>()
  for (const l of lignes) {
    const arr = parTranche.get(l.tranche) ?? []
    arr.push({ beat_id: l.beat_id, ecoutes: Number(l.ecoutes), free_dl: Number(l.free_dl), favoris: Number(l.favoris) })
    parTranche.set(l.tranche, arr)
  }
  return slots.map(s => parTranche.get(dayKeyInTz(s.from, tz)) ?? [])
}

export const sommeTranche = (lignes: EvenementsTranche[], champ: 'ecoutes' | 'free_dl' | 'favoris') =>
  lignes.reduce((s, l) => s + l[champ], 0)
