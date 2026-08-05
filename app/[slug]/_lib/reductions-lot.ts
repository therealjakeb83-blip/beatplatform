import type { CartItem } from '../_components/CartContext'

// Aperçu client de la réduction par lot ("achète X, obtiens Y offert") —
// affichage uniquement. Le montant réellement facturé est toujours recalculé
// côté serveur dans lib/pricing.ts (calculerLignesPanier), jamais ici.

export type ReductionLotRule = {
  id: string
  licenceId: string
  nbAAcheter: number
  nbOfferts: number
}

export type ItemPricing = CartItem & { isFree: boolean }

function groupByLicence(items: CartItem[]): Map<string, { item: CartItem; index: number }[]> {
  const groupes = new Map<string, { item: CartItem; index: number }[]>()
  items.forEach((item, index) => {
    const groupe = groupes.get(item.licenceId) ?? []
    groupe.push({ item, index })
    groupes.set(item.licenceId, groupe)
  })
  return groupes
}

/** Index (dans `items`) des articles offerts — le moins cher par groupe de
 * licence, dernier ajouté au panier en cas d'égalité. Même règle que
 * lib/pricing.ts côté serveur. */
export function computeFreeIndexes(items: CartItem[], regles: ReductionLotRule[]): Set<number> {
  const reglesParLicence = new Map(regles.map(r => [r.licenceId, r]))
  const groupes = groupByLicence(items)
  const free = new Set<number>()

  for (const [licenceId, groupe] of groupes) {
    const regle = reglesParLicence.get(licenceId)
    if (!regle) continue
    const tailleLot = regle.nbAAcheter + regle.nbOfferts
    const nbOffertsTotal = Math.floor(groupe.length / tailleLot) * regle.nbOfferts
    if (nbOffertsTotal === 0) continue

    const trie = [...groupe].sort((a, b) => a.item.prix - b.item.prix || b.index - a.index)
    for (const entry of trie.slice(0, nbOffertsTotal)) free.add(entry.index)
  }

  return free
}

export function computeItemsPricing(items: CartItem[], regles: ReductionLotRule[]): ItemPricing[] {
  const free = computeFreeIndexes(items, regles)
  return items.map((item, index) => ({ ...item, isFree: free.has(index) }))
}

export function computeTotal(items: CartItem[], regles: ReductionLotRule[]): number {
  const free = computeFreeIndexes(items, regles)
  return items.reduce((sum, item, index) => (free.has(index) ? sum : sum + item.prix), 0)
}

export function hasFreeItem(items: CartItem[], regles: ReductionLotRule[]): boolean {
  return computeFreeIndexes(items, regles).size > 0
}

export type PromoBannerState = {
  licenceNom: string
  nbOfferts: number
  tailleLot: number
  position: number // nb d'articles déjà dans le cycle courant (0 = vient de débloquer)
  remaining: number // nb d'articles encore à ajouter avant de compléter le lot
  ready: boolean // le prochain article ajouté dans cette licence complète le lot
}

/** Bandeau incitatif : la licence la plus avancée dans son cycle courant
 * (position % tailleLot la plus haute), en ignorant celles qui viennent de
 * débloquer un lot (position 0 — rien à inciter juste après). */
export function computePromoBanner(items: CartItem[], regles: ReductionLotRule[]): PromoBannerState | null {
  const reglesParLicence = new Map(regles.map(r => [r.licenceId, r]))
  const groupes = groupByLicence(items)

  let best: { regle: ReductionLotRule; licenceNom: string; position: number } | null = null

  for (const [licenceId, groupe] of groupes) {
    const regle = reglesParLicence.get(licenceId)
    if (!regle) continue
    const tailleLot = regle.nbAAcheter + regle.nbOfferts
    const position = groupe.length % tailleLot
    if (position === 0) continue
    if (!best || position > best.position) {
      best = { regle, licenceNom: groupe[0].item.licenceNom, position }
    }
  }

  if (!best) return null
  const tailleLot = best.regle.nbAAcheter + best.regle.nbOfferts
  const remaining = tailleLot - best.position

  return {
    licenceNom: best.licenceNom,
    nbOfferts: best.regle.nbOfferts,
    tailleLot,
    position: best.position,
    remaining,
    ready: remaining === 1,
  }
}

export function formatPrix(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`
}
