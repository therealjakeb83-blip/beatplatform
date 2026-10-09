import type { SupabaseClient } from '@supabase/supabase-js'
import { toutesLesLignes } from '@/app/dashboard/business/_lib/requetes'
import { sim } from '@/lib/similarite'

// Relier les titres des commandes importées au catalogue (import lot 3).
// JAMAIS de lien automatique : on PROPOSE le beat le plus proche, le
// beatmaker valide. Titre importé = titre entier (« Mama | No Drums ») ; sur
// My Producer le beat s'appelle souvent juste « Mama » → comparaison par
// ressemblance, comme la détection de doublons (décision de Jake, 2026-10-09) :
//   identique   : titre entier = titre du beat
//   debut       : partie avant le 1er « | » = titre du beat
//   ressemblant : partie avant le 1er « | » ressemble au titre à 80 % ou plus
// Un seul meilleur beat, sinon rien (égalité = au beatmaker de choisir).
// Beats supprimés jamais proposés. La décision est mémorisée par titre normalisé
// (liens_titres_externes) et réappliquée aux imports suivants. Sert au CRM
// (préférences musicales, pochette), jamais à Analytics.

export function normaliserTitre(titre: string): string {
  return titre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export type DecisionLien = 'a_traiter' | 'relier' | 'ne_pas_relier'

export type NiveauProposition = 'identique' | 'debut' | 'ressemblant'

export const SEUIL_RESSEMBLANCE = 0.8

export type BeatCatalogue = { id: string; titre: string; image_url: string | null; supprime: boolean }

export type GroupeTitre = {
  cle: string
  libelle: string
  titres: string[]
  nbVentes: number
  decision: DecisionLien
  beatId: string | null
  propositionId: string | null
  propositionNiveau: NiveauProposition | null
  propositionScore: number | null
}

// Débuts de titre : seule la partie avant le premier « | », normalisée
function debutDuTitre(cle: string): string | null {
  if (!cle.includes('|')) return null
  const debut = cle.split('|')[0].trim()
  return debut || null
}

const RANG: Record<NiveauProposition, number> = { identique: 3, debut: 2, ressemblant: 1 }

type Candidat = { id: string; niveau: NiveauProposition; score: number }

export function meilleureProposition(cle: string, beats: { id: string; cle: string }[]): Candidat | null {
  const debut = debutDuTitre(cle)
  const base = debut ?? cle
  let meilleur: Candidat | null = null
  let egalite = false
  for (const b of beats) {
    let c: Candidat | null = null
    if (b.cle === cle) c = { id: b.id, niveau: 'identique', score: 1 }
    else if (debut && b.cle === debut) c = { id: b.id, niveau: 'debut', score: 1 }
    else {
      const s = sim(base, b.cle, SEUIL_RESSEMBLANCE)
      if (s >= SEUIL_RESSEMBLANCE) c = { id: b.id, niveau: 'ressemblant', score: s }
    }
    if (!c) continue
    const ordre = meilleur ? (RANG[c.niveau] - RANG[meilleur.niveau]) || (c.score - meilleur.score) : 1
    if (ordre > 0) { meilleur = c; egalite = false }
    else if (ordre === 0) egalite = true
  }
  return egalite ? null : meilleur
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
  const beatsVivants = beats.filter(b => !b.supprime).map(b => ({ id: b.id, cle: normaliserTitre(b.titre) })).filter(b => b.cle)

  const groupes: GroupeTitre[] = []
  for (const [cle, variantes] of parCle) {
    const tri = [...variantes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const m = memoireParCle.get(cle)
    const proposition = m ? null : meilleureProposition(cle, beatsVivants)
    groupes.push({
      cle,
      libelle: tri[0][0],
      titres: tri.map(([t]) => t),
      nbVentes: tri.reduce((s, [, n]) => s + n, 0),
      decision: m?.decision ?? 'a_traiter',
      beatId: m?.decision === 'relier' ? m.beat_id : null,
      propositionId: proposition?.id ?? null,
      propositionNiveau: proposition?.niveau ?? null,
      propositionScore: proposition?.score ?? null,
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
