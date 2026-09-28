import { repartirCentimes } from '@/lib/collaboration-parts'
import type { LigneCalculee } from '@/lib/pricing'

// Répartition d'un panier entre ses vendeurs (Phase 13) — tout en centimes.
// Tranche du propriétaire de la boutique (A) = ses lignes solo + sa part des
// lignes collab ; tranche de chaque collaborateur = sa part des lignes collab.
// Invariant : la somme des tranches est exactement le total du panier.

export type DetailLigneTranche = {
  beat_id: string
  licence_id: string
  prix_ligne_cents: number
  pourcentage: number
  montant_cents: number
}

export type TrancheCalculee = {
  vendeur_id: string
  est_proprietaire: boolean
  montant_cents: number
  detail_lignes: DetailLigneTranche[]
}

export function panierEstMultiVendeurs(lignes: Pick<LigneCalculee, 'participants'>[]): boolean {
  return lignes.some(l => l.participants && l.participants.length > 1)
}

export function repartirPanier(
  lignes: Pick<LigneCalculee, 'beat_id' | 'licence_id' | 'prixTotalCents' | 'participants'>[],
  proprietaireId: string,
): TrancheCalculee[] {
  const tranches = new Map<string, TrancheCalculee>()
  const tranche = (vendeurId: string) => {
    let t = tranches.get(vendeurId)
    if (!t) {
      t = { vendeur_id: vendeurId, est_proprietaire: vendeurId === proprietaireId, montant_cents: 0, detail_lignes: [] }
      tranches.set(vendeurId, t)
    }
    return t
  }
  tranche(proprietaireId)

  for (const l of lignes) {
    const participants = l.participants?.length ? l.participants : [{ id: proprietaireId, pourcentage: 100 }]
    const parts = l.prixTotalCents > 0
      ? repartirCentimes(l.prixTotalCents, participants)
      : participants.map(p => ({ id: p.id, centimes: 0 }))
    for (const part of parts) {
      const t = tranche(part.id)
      t.montant_cents += part.centimes
      t.detail_lignes.push({
        beat_id: l.beat_id,
        licence_id: l.licence_id,
        prix_ligne_cents: l.prixTotalCents,
        pourcentage: participants.find(p => p.id === part.id)!.pourcentage,
        montant_cents: part.centimes,
      })
    }
  }

  const total = lignes.reduce((s, l) => s + l.prixTotalCents, 0)
  const resultat = [...tranches.values()]
  if (resultat.reduce((s, t) => s + t.montant_cents, 0) !== total) {
    throw new Error('Répartition du panier incohérente : la somme des tranches ne fait pas le total.')
  }
  return resultat
}

/** Pourcentage commun à toutes les lignes d'une tranche, sinon null (tranche mixte). */
export function pourcentageUnique(t: TrancheCalculee): number | null {
  const pcts = new Set(t.detail_lignes.map(d => d.pourcentage))
  return pcts.size === 1 ? [...pcts][0] : null
}
