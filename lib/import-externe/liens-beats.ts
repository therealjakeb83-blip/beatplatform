import type { SupabaseClient } from '@supabase/supabase-js'
import { toutesLesLignes } from '@/app/dashboard/business/_lib/requetes'

// Relier les titres des commandes importées au catalogue (import lot 3).
// JAMAIS de lien automatique : on propose seulement quand le titre correspond
// exactement (casse, accents, espaces ignorés) à UN SEUL beat non supprimé ;
// le beatmaker valide. La décision est mémorisée par titre normalisé
// (liens_titres_externes) et réappliquée aux imports suivants. Sert au CRM
// (préférences musicales, pochette), jamais à Analytics.

export function normaliserTitre(titre: string): string {
  return titre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export type DecisionLien = 'a_traiter' | 'relier' | 'ne_pas_relier'

export type BeatCatalogue = { id: string; titre: string; image_url: string | null; supprime: boolean }

export type GroupeTitre = {
  cle: string
  libelle: string
  titres: string[]
  nbVentes: number
  decision: DecisionLien
  beatId: string | null
  propositionId: string | null
}

type LigneTitre = { titre: string }
type Memoire = { cle: string; decision: 'relier' | 'ne_pas_relier'; beat_id: string | null }

export function grouperTitres(lignes: LigneTitre[], memoire: Memoire[], beats: BeatCatalogue[]): GroupeTitre[] {
  const parCle = new Map<string, Map<string, number>>()
  for (const l of lignes) {
    const cle = normaliserTitre(l.titre)
    if (!cle) continue
    const variantes = parCle.get(cle) ?? new Map<string, number>()
    variantes.set(l.titre, (variantes.get(l.titre) ?? 0) + 1)
    parCle.set(cle, variantes)
  }

  const memoireParCle = new Map(memoire.map(m => [m.cle, m]))
  const beatsParCle = new Map<string, string[]>()
  for (const b of beats) {
    if (b.supprime) continue
    const cle = normaliserTitre(b.titre)
    beatsParCle.set(cle, [...(beatsParCle.get(cle) ?? []), b.id])
  }

  const groupes: GroupeTitre[] = []
  for (const [cle, variantes] of parCle) {
    const tri = [...variantes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const m = memoireParCle.get(cle)
    const candidats = beatsParCle.get(cle) ?? []
    groupes.push({
      cle,
      libelle: tri[0][0],
      titres: tri.map(([t]) => t),
      nbVentes: tri.reduce((s, [, n]) => s + n, 0),
      decision: m?.decision ?? 'a_traiter',
      beatId: m?.decision === 'relier' ? m.beat_id : null,
      propositionId: !m && candidats.length === 1 ? candidats[0] : null,
    })
  }
  return groupes.sort((a, b) => b.nbVentes - a.nbVentes || a.libelle.localeCompare(b.libelle, 'fr'))
}

export async function chargerLignesTitres(supabase: SupabaseClient, beatmakerId: string): Promise<LigneTitre[]> {
  return toutesLesLignes<LigneTitre>((debut, fin) => supabase
    .from('commandes_externes_lignes')
    .select('titre')
    .eq('beatmaker_id', beatmakerId)
    .order('id')
    .range(debut, fin) as unknown as PromiseLike<{ data: LigneTitre[] | null; error: unknown }>)
}

export async function chargerMemoireLiens(supabase: SupabaseClient, beatmakerId: string): Promise<Memoire[]> {
  return toutesLesLignes<Memoire>((debut, fin) => supabase
    .from('liens_titres_externes')
    .select('cle, decision, beat_id')
    .eq('beatmaker_id', beatmakerId)
    .order('cle')
    .range(debut, fin) as unknown as PromiseLike<{ data: Memoire[] | null; error: unknown }>)
}

// Tout le catalogue du beatmaker, beats supprimés compris (choisissables à la
// main, jamais proposés)
export async function chargerCatalogue(supabase: SupabaseClient, beatmakerId: string): Promise<BeatCatalogue[]> {
  type Brut = { id: string; titre: string; image_url: string | null; supprime_le: string | null }
  const beats = await toutesLesLignes<Brut>((debut, fin) => supabase
    .from('beats')
    .select('id, titre, image_url, supprime_le')
    .eq('beatmaker_id', beatmakerId)
    .order('id')
    .range(debut, fin) as unknown as PromiseLike<{ data: Brut[] | null; error: unknown }>)
  return beats
    .map(b => ({ id: b.id, titre: b.titre, image_url: b.image_url, supprime: b.supprime_le !== null }))
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
}

export async function chargerGroupesTitres(supabase: SupabaseClient, beatmakerId: string) {
  const [lignes, memoire, beats] = await Promise.all([
    chargerLignesTitres(supabase, beatmakerId),
    chargerMemoireLiens(supabase, beatmakerId),
    chargerCatalogue(supabase, beatmakerId),
  ])
  return { groupes: grouperTitres(lignes, memoire, beats), beats }
}

// Import : chaque ligne reçoit le beat mémorisé pour son titre (vérifié
// ensuite par la fonction SQL contre le catalogue)
export async function beatsMemorisesParCle(supabase: SupabaseClient, beatmakerId: string): Promise<Map<string, string>> {
  const memoire = await chargerMemoireLiens(supabase, beatmakerId)
  return new Map(memoire.filter(m => m.decision === 'relier' && m.beat_id).map(m => [m.cle, m.beat_id as string]))
}
