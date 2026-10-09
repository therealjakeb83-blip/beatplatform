import type { SupabaseClient } from '@supabase/supabase-js'
import { toutesLesLignes, parLots } from '@/app/dashboard/business/_lib/requetes'

// Analytics = parts de chaque vendeur (Phase 12 Q18-Q19 / Phase 13 lot 3) :
// sur une vente à plusieurs vendeurs, le CA d'un beatmaker est SA tranche,
// jamais le total payé par le client. Le propriétaire de la boutique (A) voit
// sa part de ses propres commandes ; un collaborateur (B) retrouve en plus
// les ventes faites sur la boutique de A, pour sa part seulement.

// Phase 13, lot 4 (T21) — remboursements et litiges PAR PART : une commande
// compte tant que le vendeur garde au moins une partie de SA part. Ce qu'il a
// rendu au client (bouton de A, remboursement depuis Stripe, litige perdu)
// sort de son CA ; une part sous litige en cours est retirée le temps du
// litige (l'argent est bloqué, il apparaît dans « Litiges en cours ») ; les
// autres parts de la même commande ne bougent pas.
export const STATUTS_ANALYTICS = ['payee', 'litige', 'remboursee_partielle', 'remboursement_incomplet']

type PartCommande = {
  /** Ce que le vendeur garde (centimes), après remboursement. */
  partCents: number
  totalCents: number
  // `${beat_id}:${licence_id}` → part du vendeur sur cette ligne (centimes,
  // avant remboursement) ; null = vente solo, toutes les lignes sont à lui.
  parLigne: Map<string, number> | null
  /** Fraction de sa part que le vendeur garde (0 = la commande ne compte plus pour lui). */
  facteur: number
}

export type PartsVendeur = {
  parCommande: Map<string, PartCommande>
  /** Commandes où le vendeur a une tranche sur la boutique d'un autre. */
  autresCommandes: string[]
  /** Argent rendu au client sur SA part (remboursements + litiges perdus), par commande. */
  rembourseParCommande: Map<string, number>
}

type LigneTranche = {
  id: string
  vendeur_id: string
  commande_id: string
  montant_ttc_cents: number
  montant_rembourse_cents: number | null
  detail_lignes: { beat_id: string; licence_id: string; montant_cents: number }[] | null
  commandes: { beatmaker_id: string; prix_paye: number; statut: string }
}
type LigneLitige = { beatmaker_id: string; commande_id: string; tranche_id: string | null }
type LigneSolo = { id: string; beatmaker_id: string; prix_paye: number; montant_rembourse_cents: number | null; statut: string }

const SELECT_TRANCHES = 'id, vendeur_id, commande_id, montant_ttc_cents, montant_rembourse_cents, detail_lignes, commandes!inner(beatmaker_id, prix_paye, statut)'
// Ventes solo touchées par un remboursement ou un litige (les autres
// comptent telles quelles, sans entrée dans les parts).
const STATUTS_TOUCHES = ['litige', 'remboursee', 'remboursee_partielle', 'remboursement_incomplet']

export async function chargerPartsVendeur(admin: SupabaseClient, vendeurId: string): Promise<PartsVendeur> {
  const [tranches, litiges, solos] = await Promise.all([
    toutesLesLignes<unknown>((debut, fin) => admin
      .from('commande_tranches').select(SELECT_TRANCHES).eq('vendeur_id', vendeurId)
      .order('id').range(debut, fin)),
    toutesLesLignes<LigneLitige>((debut, fin) => admin
      .from('litiges').select('beatmaker_id, commande_id, tranche_id').eq('beatmaker_id', vendeurId).eq('statut', 'en_cours')
      .order('id').range(debut, fin)),
    toutesLesLignes<LigneSolo>((debut, fin) => admin
      .from('commandes').select('id, beatmaker_id, prix_paye, montant_rembourse_cents, statut')
      .eq('beatmaker_id', vendeurId).in('statut', STATUTS_TOUCHES)
      .order('id').range(debut, fin)),
  ])
  return construireParts(vendeurId, tranches as LigneTranche[], litiges, solos)
}

/** Parts de TOUS les vendeurs de la plateforme (vue admin) : mêmes règles
 *  que chargerPartsVendeur, en trois lectures au lieu de trois par vendeur.
 *  vendeursParCommande = vendeurs ayant une tranche sur chaque commande. */
export async function chargerPartsTousVendeurs(admin: SupabaseClient): Promise<{ parVendeur: Map<string, PartsVendeur>; vendeursParCommande: Map<string, string[]> }> {
  const [tranches, litiges, solos] = await Promise.all([
    toutesLesLignes<unknown>((debut, fin) => admin
      .from('commande_tranches').select(SELECT_TRANCHES)
      .order('id').range(debut, fin)),
    toutesLesLignes<LigneLitige>((debut, fin) => admin
      .from('litiges').select('beatmaker_id, commande_id, tranche_id').eq('statut', 'en_cours')
      .order('id').range(debut, fin)),
    toutesLesLignes<LigneSolo>((debut, fin) => admin
      .from('commandes').select('id, beatmaker_id, prix_paye, montant_rembourse_cents, statut')
      .in('statut', STATUTS_TOUCHES)
      .order('id').range(debut, fin)),
  ])
  const grouper = <T,>(rows: T[], cle: (r: T) => string) => {
    const m = new Map<string, T[]>()
    for (const r of rows) m.set(cle(r), [...(m.get(cle(r)) ?? []), r])
    return m
  }
  const tranchesPar = grouper(tranches as LigneTranche[], r => r.vendeur_id)
  const litigesPar = grouper(litiges, r => r.beatmaker_id)
  const solosPar = grouper(solos, r => r.beatmaker_id)
  const parVendeur = new Map<string, PartsVendeur>()
  for (const v of new Set([...tranchesPar.keys(), ...solosPar.keys()])) {
    parVendeur.set(v, construireParts(v, tranchesPar.get(v) ?? [], litigesPar.get(v) ?? [], solosPar.get(v) ?? []))
  }
  const vendeursParCommande = new Map<string, string[]>()
  for (const t of tranches as LigneTranche[]) vendeursParCommande.set(t.commande_id, [...(vendeursParCommande.get(t.commande_id) ?? []), t.vendeur_id])
  return { parVendeur, vendeursParCommande }
}

function construireParts(vendeurId: string, tranches: LigneTranche[], litiges: LigneLitige[], solos: LigneSolo[]): PartsVendeur {
  const sousLitige = new Set(litiges.map(l => l.tranche_id ?? `solo:${l.commande_id}`))

  const parCommande = new Map<string, PartCommande>()
  const rembourseParCommande = new Map<string, number>()
  const autresCommandes: string[] = []
  for (const r of tranches) {
    const rembourse = Math.min(r.montant_rembourse_cents ?? 0, r.montant_ttc_cents)
    const garde = sousLitige.has(r.id) ? 0 : r.montant_ttc_cents - rembourse
    const facteur = sousLitige.has(r.id) ? 0 : r.montant_ttc_cents > 0 ? garde / r.montant_ttc_cents : 1
    parCommande.set(r.commande_id, {
      partCents: garde,
      totalCents: Math.round(Number(r.commandes.prix_paye) * 100),
      parLigne: new Map((r.detail_lignes ?? []).map(d => [`${d.beat_id}:${d.licence_id}`, d.montant_cents])),
      facteur,
    })
    if (rembourse > 0) rembourseParCommande.set(r.commande_id, rembourse)
    if (r.commandes.beatmaker_id !== vendeurId && STATUTS_ANALYTICS.includes(r.commandes.statut)) autresCommandes.push(r.commande_id)
  }

  for (const c of solos) {
    if (parCommande.has(c.id)) continue
    const total = Math.round(Number(c.prix_paye) * 100)
    const rembourse = c.statut === 'remboursee' ? total : Math.min(c.montant_rembourse_cents ?? 0, total)
    const enLitige = sousLitige.has(`solo:${c.id}`)
    const garde = enLitige ? 0 : total - rembourse
    parCommande.set(c.id, { partCents: garde, totalCents: total, parLigne: null, facteur: total > 0 ? garde / total : 1 })
    if (rembourse > 0) rembourseParCommande.set(c.id, rembourse)
  }
  return { parCommande, autresCommandes, rembourseParCommande }
}

/** Montant d'une commande ramené à ce que le vendeur garde (null si plus
 *  rien : part rendue au client ou sous litige en cours). */
export function partDeCommande<T extends { id: string; prix_paye: number; reduction_montant?: number | null }>(c: T, parts: PartsVendeur): T | null {
  const p = parts.parCommande.get(c.id)
  if (!p) return c
  if (p.facteur === 0) return null
  const ratio = p.totalCents > 0 ? p.partCents / p.totalCents : 0
  return {
    ...c,
    prix_paye: p.partCents / 100,
    ...(c.reduction_montant != null ? { reduction_montant: c.reduction_montant * ratio } : {}),
  }
}

export function partsDeCommandes<T extends { id: string; prix_paye: number; reduction_montant?: number | null }>(commandes: T[], parts: PartsVendeur): T[] {
  return commandes.map(c => partDeCommande(c, parts)).filter((c): c is T => c !== null)
}

/** Montant d'une ligne de commande ramené à ce que le vendeur garde (null si
 *  le vendeur n'a aucune part sur cette ligne ou n'en garde plus rien). */
export function partDeLigne<T extends { commande_id: string; beat_id: string; licence_id: string; prix_paye: number; reduction_montant?: number | null }>(
  l: T,
  parts: PartsVendeur,
): T | null {
  const p = parts.parCommande.get(l.commande_id)
  if (!p) return l
  if (p.facteur === 0) return null
  const prixLigneCents = Math.round(Number(l.prix_paye) * 100)
  const avant = p.parLigne ? p.parLigne.get(`${l.beat_id}:${l.licence_id}`) : prixLigneCents
  if (avant == null) return null
  const partCents = Math.round(avant * p.facteur)
  const ratio = prixLigneCents > 0 ? partCents / prixLigneCents : 0
  return {
    ...l,
    prix_paye: partCents / 100,
    ...(l.reduction_montant != null ? { reduction_montant: l.reduction_montant * ratio } : {}),
  }
}

export function partsDeLignes<T extends { commande_id: string; beat_id: string; licence_id: string; prix_paye: number; reduction_montant?: number | null }>(
  lignes: T[],
  parts: PartsVendeur,
): T[] {
  return lignes.map(l => partDeLigne(l, parts)).filter((l): l is T => l !== null)
}

// Flux des collaborations (demande de Jake, lot 3) — deux données, jamais
// mélangées au CA d'un autre vendeur :
// - recus : ma part des ventes faites sur la boutique d'un AUTRE (je suis B) ;
// - collaborateurs : la part des ventes de MA boutique qui revient directement
//   à mes collaborateurs (je suis A). Rien ne transite par moi : information.
export type FluxCollab = { created_at: string; montant: number }

export async function chargerFluxCollab(admin: SupabaseClient, vendeurId: string): Promise<{ recus: FluxCollab[]; collaborateurs: FluxCollab[] }> {
  const select = 'id, montant_ttc_cents, montant_rembourse_cents, commandes!inner(beatmaker_id, statut, created_at)'
  type Row = { id: string; montant_ttc_cents: number; montant_rembourse_cents: number | null; commandes: { created_at: string } }
  const [recus, collaborateurs] = await Promise.all([
    toutesLesLignes<Row>((debut, fin) => admin.from('commande_tranches')
      .select(select)
      .eq('vendeur_id', vendeurId)
      .neq('commandes.beatmaker_id', vendeurId)
      .in('commandes.statut', STATUTS_ANALYTICS)
      .order('id')
      .range(debut, fin) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>),
    toutesLesLignes<Row>((debut, fin) => admin.from('commande_tranches')
      .select(select)
      .eq('commandes.beatmaker_id', vendeurId)
      .eq('est_proprietaire', false)
      .in('commandes.statut', STATUTS_ANALYTICS)
      .order('id')
      .range(debut, fin) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>),
  ])
  const lignes = [...recus, ...collaborateurs]
  const litiges = await parLots<{ tranche_id: string }>(lignes.map(r => r.id), lot =>
    admin.from('litiges').select('tranche_id').eq('statut', 'en_cours').in('tranche_id', lot))
  const sousLitige = new Set(litiges.map(l => l.tranche_id))
  // Même règle que le CA : ce qui a été rendu au client, ou est bloqué par un
  // litige en cours, ne compte pas.
  const versFlux = (rows: Row[]) => rows
    .filter(r => !sousLitige.has(r.id))
    .map(r => ({ created_at: r.commandes.created_at, montant: Math.max(r.montant_ttc_cents - (r.montant_rembourse_cents ?? 0), 0) / 100, ttc: r.montant_ttc_cents }))
    .filter(f => f.montant > 0 || f.ttc === 0)
    .map(({ created_at, montant }) => ({ created_at, montant }))
  return { recus: versFlux(recus), collaborateurs: versFlux(collaborateurs) }
}
