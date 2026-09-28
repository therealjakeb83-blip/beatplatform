import type { SupabaseClient } from '@supabase/supabase-js'
import { calculerPretAVendreOuExempte } from '@/lib/pret-a-vendre'

// Feu vert d'un beat en collaboration (Phase 12, lot 4) : il n'est vendable
// que si TOUS les collaborateurs ont accepté, que TOUS les vendeurs (A et
// chaque B actif) sont « prêts à vendre », et que l'interrupteur global des
// ventes collab est ON. La partie « accords + interrupteur » est aussi
// reflétée en base dans beats.hors_vente_collab (visibilité boutique) ; la
// partie « vendeurs prêts » n'existe qu'ici, vérifiée au paiement.

// Double verrou : même interrupteur ON, aucun panier avec un beat collab ne
// peut être payé tant que ce drapeau est faux. Ouvert au lot 1 de la Phase 13
// (paiement réparti entre vendeurs, lib/paiement-multi.ts).
export const PAIEMENT_MULTI_VENDEURS_DISPONIBLE = true

export type RaisonFeuRouge = 'accords_incomplets' | 'ventes_collab_fermees' | 'vendeur_pas_pret'

export type ResultatFeuVert =
  | { ok: true; collab: boolean }
  | { ok: false; raison: RaisonFeuRouge }

// Fonction pure — `statuts` = collaborations non terminées du beat
// (invitee/active/refusee), `vendeursPrets` = A puis chaque B actif.
export function evaluerFeuVertCollab(p: {
  statuts: string[]
  interrupteurVentesCollab: boolean
  vendeursPrets: boolean[]
}): ResultatFeuVert {
  if (p.statuts.length === 0) return { ok: true, collab: false }
  if (p.statuts.some(s => s !== 'active')) return { ok: false, raison: 'accords_incomplets' }
  if (!p.interrupteurVentesCollab) return { ok: false, raison: 'ventes_collab_fermees' }
  if (p.vendeursPrets.some(pret => !pret)) return { ok: false, raison: 'vendeur_pas_pret' }
  return { ok: true, collab: true }
}

export async function lireInterrupteurVentesCollab(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from('parametres_plateforme').select('ventes_collab_actives').eq('id', true).maybeSingle()
  return !!data?.ventes_collab_actives
}

async function vendeurPret(admin: SupabaseClient, beatmakerId: string, estConcedant: boolean): Promise<boolean> {
  return (await calculerPretAVendreOuExempte(admin, beatmakerId, { estConcedant })).pret
}

export async function verifierFeuVertBeat(admin: SupabaseClient, beatId: string): Promise<ResultatFeuVert> {
  const [{ data: beat }, { data: splits }] = await Promise.all([
    admin.from('beats').select('beatmaker_id').eq('id', beatId).maybeSingle(),
    admin.from('beat_splits').select('statut, beatmaker_id').eq('beat_id', beatId).in('statut', ['invitee', 'active', 'refusee']),
  ])
  const collaborations = (splits ?? []) as { statut: string; beatmaker_id: string | null }[]
  const statuts = collaborations.map(s => s.statut)

  const sansVendeurs = evaluerFeuVertCollab({ statuts, interrupteurVentesCollab: true, vendeursPrets: [] })
  if (!sansVendeurs.ok || !sansVendeurs.collab) return sansVendeurs

  const interrupteur = await lireInterrupteurVentesCollab(admin)
  if (!interrupteur || !beat) return evaluerFeuVertCollab({ statuts, interrupteurVentesCollab: interrupteur, vendeursPrets: [] })

  const vendeursPrets = await Promise.all([
    vendeurPret(admin, beat.beatmaker_id as string, true),
    ...collaborations.map(s => (s.beatmaker_id ? vendeurPret(admin, s.beatmaker_id, false) : Promise.resolve(false))),
  ])
  return evaluerFeuVertCollab({ statuts, interrupteurVentesCollab: interrupteur, vendeursPrets })
}
