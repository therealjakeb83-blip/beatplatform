import type { SupabaseClient } from '@supabase/supabase-js'
import type { LigneCalculee } from '@/lib/pricing'
import { decomposerTva } from '@/lib/collaboration-parts'
import { panierEstMultiVendeurs, repartirPanier } from '@/lib/paiement-multi-repartition'

// TVA contenue dans un panier (toujours absorbée : le prix affiché reste le
// prix payé). Sur un beat collab, chaque vendeur applique SA TVA à SA part
// seulement — un vendeur non assujetti n'en facture aucune (Phase 13, lot 3 :
// avant, le taux de A était appliqué au total entier, affichage faux dès
// qu'un seul des vendeurs est assujetti). Même calcul que les factures.
export type TvaPanier = { montantCents: number; taux: number | null }

export async function calculerTvaPanier(
  admin: SupabaseClient,
  lignes: Pick<LigneCalculee, 'beat_id' | 'licence_id' | 'prixTotalCents' | 'participants'>[],
  proprietaire: { id: string; tva_active: boolean | null; tva_taux: number | null },
): Promise<TvaPanier | null> {
  const tranches = panierEstMultiVendeurs(lignes)
    ? repartirPanier(lignes, String(proprietaire.id))
    : [{ vendeur_id: String(proprietaire.id), montant_cents: lignes.reduce((s, l) => s + l.prixTotalCents, 0) }]

  const autres = tranches.map(t => t.vendeur_id).filter(id => id !== String(proprietaire.id))
  const { data: vendeurs } = autres.length
    ? await admin.from('beatmakers').select('id, tva_active, tva_taux').in('id', autres)
    : { data: [] }
  const tauxParVendeur = new Map<string, number>([
    [String(proprietaire.id), proprietaire.tva_active && proprietaire.tva_taux ? Number(proprietaire.tva_taux) : 0],
    ...(vendeurs ?? []).map(v => [v.id as string, v.tva_active && v.tva_taux ? Number(v.tva_taux) : 0] as [string, number]),
  ])

  let montantCents = 0
  const taux = new Set<number>()
  for (const t of tranches) {
    if (t.montant_cents <= 0) continue
    const tx = tauxParVendeur.get(t.vendeur_id) ?? 0
    taux.add(tx)
    montantCents += decomposerTva(t.montant_cents, tx).tvaCents
  }
  if (montantCents <= 0) return null
  // Un seul taux pour tout le montant : affiché (« dont 20 % TVA ») ; sinon
  // (une part avec TVA, une sans, ou deux taux) : montant seul.
  return { montantCents, taux: taux.size === 1 ? [...taux][0] : null }
}
