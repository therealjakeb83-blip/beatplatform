import type { SupabaseClient } from '@supabase/supabase-js'
import { toutesLesLignes, parLots } from './requetes'

// Commandes importées d'autres plateformes (table commandes_externes) vues
// par le CRM comme des achats de licence : statut Client, total dépensé (en €,
// taux BCE figé à l'import), nombre d'achats/commandes, premier contact,
// dernier achat. Lues UNIQUEMENT par le CRM — jamais Analytics, factures,
// crons ni automatisations. Beat offert = 0 € : commande, pas achat (même
// règle que les commandes My Producer). Format libre : date ou montant
// INCONNUS (null) — comptée dans le nombre de commandes, jamais dans le total,
// le panier, l'ancienneté ni le dernier achat.

export type CommandeExterneCrm = {
  id: string
  client_id: string
  created_at: string | null
  prix_paye: number | null
  statut: 'payee'
  montant_rembourse_cents: number
  type_commande: 'LICENCE'
  commande_lignes: { beat_id: string | null; licence_id: string | null }[]
  externe: true
}

type Ligne = {
  id: string
  client_id: string
  date_vente: string | null
  total_depense_eur: number | string | null
  commandes_externes_lignes: { beat_id: string | null; licence_id: string | null }[] | null
}

const SELECT = 'id, client_id, date_vente, total_depense_eur, commandes_externes_lignes(beat_id, licence_id)'

const nombre = (v: number | string | null) => (v === null ? null : Number(v))

function versCrm(l: Ligne): CommandeExterneCrm {
  return {
    id: l.id,
    client_id: l.client_id,
    created_at: l.date_vente,
    prix_paye: nombre(l.total_depense_eur),
    statut: 'payee',
    montant_rembourse_cents: 0,
    type_commande: 'LICENCE',
    commande_lignes: (l.commandes_externes_lignes ?? []).map(x => ({ beat_id: x.beat_id, licence_id: x.licence_id })),
    externe: true,
  }
}

// Toutes les commandes importées d'un beatmaker (ou seulement de certains clients)
export async function chargerCommandesExternesCrm(
  supabase: SupabaseClient,
  beatmakerId: string,
  clientIds?: string[],
): Promise<CommandeExterneCrm[]> {
  if (clientIds) {
    if (clientIds.length === 0) return []
    const lignes = await parLots<Ligne>(clientIds, lot =>
      supabase.from('commandes_externes').select(SELECT).eq('beatmaker_id', beatmakerId).in('client_id', lot) as unknown as PromiseLike<{ data: Ligne[] | null; error: unknown }>,
    )
    return lignes.map(versCrm)
  }
  const lignes = await toutesLesLignes<Ligne>((debut, fin) =>
    supabase.from('commandes_externes').select(SELECT).eq('beatmaker_id', beatmakerId).order('id').range(debut, fin) as unknown as PromiseLike<{ data: Ligne[] | null; error: unknown }>,
  )
  return lignes.map(versCrm)
}

// ── Détail (fiche client, page Commandes importées) ──────────────────────

export type BeatLie = {
  titre: string; image_url: string | null
  styles: string[] | null; type_beat: string[] | null; ambiances: string[] | null; instruments: string[] | null
}

type LigneDetailBrute = {
  id: string; ordre: number; titre: string | null; titre_original: string | null; licence: string | null
  prix_catalogue: number | string | null; remise: number | string | null; montant_depense: number | string | null
  montant_paye: number | string | null; montant_depense_eur: number | string | null; offert: boolean
  vendeur_principal: string | null; collaborateurs: string[] | null; beat_id: string | null
  licence_id: string | null
  beats: BeatLie | null
  licences: { nom: string } | null
}

export type CommandeDetailBrute = {
  id: string; client_id: string; plateforme: string; numero_externe: string; date_vente: string | null
  devise: string; taux_change: number | string | null; date_taux: string | null
  total_catalogue: number | string | null; total_remise: number | string | null; total_depense: number | string | null
  total_paye: number | string | null; total_depense_eur: number | string | null; type_boutique: string | null
  reference_paiement: string | null; acheteur_nom: string | null; acheteur_email: string; import_id: string
  imports_externes: { created_at: string; nom_fichier: string | null } | null
  commandes_externes_lignes: LigneDetailBrute[] | null
}

export const SELECT_DETAIL = `id, client_id, plateforme, numero_externe, date_vente, devise, taux_change, date_taux,
  total_catalogue, total_remise, total_depense, total_paye, total_depense_eur, type_boutique, reference_paiement,
  acheteur_nom, acheteur_email, import_id, imports_externes(created_at, nom_fichier),
  commandes_externes_lignes(id, ordre, titre, titre_original, licence, prix_catalogue, remise, montant_depense,
    montant_paye, montant_depense_eur, offert, vendeur_principal, collaborateurs, beat_id, licence_id,
    beats(titre, image_url, styles, type_beat, ambiances, instruments), licences(nom))`

export type CommandeDetail = {
  id: string; client_id: string; plateforme: string; numero_externe: string; date_vente: string | null
  devise: string; taux_change: number | null; date_taux: string | null
  total_catalogue: number | null; total_remise: number | null; total_depense: number | null; total_paye: number | null; total_depense_eur: number | null
  type_boutique: string | null; reference_paiement: string | null; acheteur_nom: string | null; acheteur_email: string
  import_id: string; import_date: string | null; import_fichier: string | null
  lignes: {
    id: string; titre: string | null; titre_original: string | null; licence: string | null
    prix_catalogue: number | null; remise: number | null; montant_depense: number | null; montant_paye: number | null; montant_depense_eur: number | null
    offert: boolean; vendeur_principal: string | null; collaborateurs: string[]; image_url: string | null
    beat_id: string | null; beat: BeatLie | null
    licence_id: string | null; licence_boutique: string | null
  }[]
}

export function versDetail(c: CommandeDetailBrute): CommandeDetail {
  return {
    id: c.id, client_id: c.client_id, plateforme: c.plateforme, numero_externe: c.numero_externe,
    date_vente: c.date_vente, devise: c.devise, taux_change: nombre(c.taux_change), date_taux: c.date_taux,
    total_catalogue: nombre(c.total_catalogue), total_remise: nombre(c.total_remise),
    total_depense: nombre(c.total_depense), total_paye: nombre(c.total_paye), total_depense_eur: nombre(c.total_depense_eur),
    type_boutique: c.type_boutique, reference_paiement: c.reference_paiement,
    acheteur_nom: c.acheteur_nom, acheteur_email: c.acheteur_email, import_id: c.import_id,
    import_date: c.imports_externes?.created_at ?? null, import_fichier: c.imports_externes?.nom_fichier ?? null,
    lignes: [...(c.commandes_externes_lignes ?? [])].sort((a, b) => a.ordre - b.ordre).map(l => ({
      id: l.id, titre: l.titre, titre_original: l.titre_original, licence: l.licence,
      prix_catalogue: nombre(l.prix_catalogue), remise: nombre(l.remise), montant_depense: nombre(l.montant_depense),
      montant_paye: nombre(l.montant_paye), montant_depense_eur: nombre(l.montant_depense_eur), offert: l.offert,
      vendeur_principal: l.vendeur_principal, collaborateurs: l.collaborateurs ?? [],
      image_url: l.beats?.image_url ?? null, beat_id: l.beat_id, beat: l.beats,
      licence_id: l.licence_id, licence_boutique: l.licences?.nom ?? null,
    })),
  }
}

export async function chargerCommandesImporteesClient(
  supabase: SupabaseClient,
  beatmakerId: string,
  clientIds: string[],
): Promise<CommandeDetail[]> {
  if (clientIds.length === 0) return []
  const brutes = await parLots<CommandeDetailBrute>(clientIds, lot =>
    supabase.from('commandes_externes').select(SELECT_DETAIL).eq('beatmaker_id', beatmakerId).in('client_id', lot) as unknown as PromiseLike<{ data: CommandeDetailBrute[] | null; error: unknown }>,
  )
  return brutes.map(versDetail).sort((a, b) => (b.date_vente ?? '').localeCompare(a.date_vente ?? ''))
}

// Pour les fonctions de calcul du CRM (_lib/ltv.ts)
export function versCrmDepuisDetail(c: CommandeDetail): CommandeExterneCrm {
  return {
    id: c.id, client_id: c.client_id, created_at: c.date_vente, prix_paye: c.total_depense_eur,
    statut: 'payee', montant_rembourse_cents: 0, type_commande: 'LICENCE',
    commande_lignes: c.lignes.map(l => ({ beat_id: l.beat_id, licence_id: l.licence_id })), externe: true,
  }
}
