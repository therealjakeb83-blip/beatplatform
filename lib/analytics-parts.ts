import type { SupabaseClient } from '@supabase/supabase-js'

// Analytics = parts de chaque vendeur (Phase 12 Q18-Q19 / Phase 13 lot 3) :
// sur une vente à plusieurs vendeurs, le CA d'un beatmaker est SA tranche,
// jamais le total payé par le client. Le propriétaire de la boutique (A) voit
// sa part de ses propres commandes ; un collaborateur (B) retrouve en plus
// les ventes faites sur la boutique de A, pour sa part seulement.

type PartCommande = {
  partCents: number
  totalCents: number
  // `${beat_id}:${licence_id}` → part du vendeur sur cette ligne (centimes)
  parLigne: Map<string, number>
}

export type PartsVendeur = {
  parCommande: Map<string, PartCommande>
  /** Commandes payées où le vendeur a une tranche sur la boutique d'un autre. */
  autresCommandes: string[]
}

export async function chargerPartsVendeur(admin: SupabaseClient, vendeurId: string): Promise<PartsVendeur> {
  const { data } = await admin
    .from('commande_tranches')
    .select('commande_id, montant_ttc_cents, detail_lignes, commandes!inner(beatmaker_id, prix_paye, statut)')
    .eq('vendeur_id', vendeurId)

  type Row = {
    commande_id: string
    montant_ttc_cents: number
    detail_lignes: { beat_id: string; licence_id: string; montant_cents: number }[] | null
    commandes: { beatmaker_id: string; prix_paye: number; statut: string }
  }
  const parCommande = new Map<string, PartCommande>()
  const autresCommandes: string[] = []
  for (const r of (data ?? []) as unknown as Row[]) {
    parCommande.set(r.commande_id, {
      partCents: r.montant_ttc_cents,
      totalCents: Math.round(Number(r.commandes.prix_paye) * 100),
      parLigne: new Map((r.detail_lignes ?? []).map(d => [`${d.beat_id}:${d.licence_id}`, d.montant_cents])),
    })
    if (r.commandes.beatmaker_id !== vendeurId && r.commandes.statut === 'payee') autresCommandes.push(r.commande_id)
  }
  return { parCommande, autresCommandes }
}

/** Montant d'une commande ramené à la part du vendeur (inchangé en solo). */
export function partDeCommande<T extends { id: string; prix_paye: number; reduction_montant?: number | null }>(c: T, parts: PartsVendeur): T {
  const p = parts.parCommande.get(c.id)
  if (!p) return c
  const ratio = p.totalCents > 0 ? p.partCents / p.totalCents : 0
  return {
    ...c,
    prix_paye: p.partCents / 100,
    ...(c.reduction_montant != null ? { reduction_montant: c.reduction_montant * ratio } : {}),
  }
}

/** Montant d'une ligne de commande ramené à la part du vendeur (null si le
 *  vendeur n'a aucune part sur cette ligne). */
export function partDeLigne<T extends { commande_id: string; beat_id: string; licence_id: string; prix_paye: number; reduction_montant?: number | null }>(
  l: T,
  parts: PartsVendeur,
): T | null {
  const p = parts.parCommande.get(l.commande_id)
  if (!p) return l
  const partCents = p.parLigne.get(`${l.beat_id}:${l.licence_id}`)
  if (partCents == null) return null
  const prixLigneCents = Math.round(Number(l.prix_paye) * 100)
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
  const [{ data: recus }, { data: collaborateurs }] = await Promise.all([
    admin.from('commande_tranches')
      .select('montant_ttc_cents, commandes!inner(beatmaker_id, statut, created_at)')
      .eq('vendeur_id', vendeurId)
      .neq('commandes.beatmaker_id', vendeurId)
      .eq('commandes.statut', 'payee'),
    admin.from('commande_tranches')
      .select('montant_ttc_cents, commandes!inner(beatmaker_id, statut, created_at)')
      .eq('commandes.beatmaker_id', vendeurId)
      .eq('est_proprietaire', false)
      .eq('commandes.statut', 'payee'),
  ])
  type Row = { montant_ttc_cents: number; commandes: { created_at: string } }
  const versFlux = (rows: unknown) => ((rows ?? []) as Row[]).map(r => ({ created_at: r.commandes.created_at, montant: r.montant_ttc_cents / 100 }))
  return { recus: versFlux(recus), collaborateurs: versFlux(collaborateurs) }
}
