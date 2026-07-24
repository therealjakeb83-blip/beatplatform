import { createAdminClient } from '@/utils/supabase/admin'

export type ResultatRechercheAdmin = {
  beatmakers: { id: string; nom_artiste: string; slug: string; email: string; statut: string }[]
  clients: { id: string; nom: string; prenom: string; email: string }[]
  commandes: { id: string; beatmaker_id: string; client_id: string; acheteur_email: string | null; prix_paye: number; statut: string; created_at: string }[]
  abonnements: { id: string; beatmaker_id: string; client_id: string; acheteur_email: string | null; statut: string; created_at: string }[]
}

const VIDE: ResultatRechercheAdmin = { beatmakers: [], clients: [], commandes: [], abonnements: [] }

// Renseigne acheteur_email depuis le client lié quand la commande/l'abonnement
// ne le porte pas directement — cas des commandes CREATION_ABONNEMENT/
// RENOUVELLEMENT (traiterPaiementAbonnement dans le webhook Stripe ne
// renseigne jamais acheteur_email, seulement client_id). Découvert en test le
// 2026-07-24 : la recherche affichait "email inconnu" alors que le client
// était bien connu via client_id.
async function completerEmailManquant<T extends { client_id: string; acheteur_email: string | null }>(
  admin: ReturnType<typeof createAdminClient>,
  lignes: T[]
): Promise<T[]> {
  const idsManquants = [...new Set(lignes.filter(l => !l.acheteur_email).map(l => l.client_id))]
  if (idsManquants.length === 0) return lignes

  const { data: clients } = await admin.from('clients').select('id, email').in('id', idsManquants)
  const emailParClient = new Map((clients ?? []).map(c => [c.id, c.email]))

  return lignes.map(l => l.acheteur_email ? l : { ...l, acheteur_email: emailParClient.get(l.client_id) ?? null })
}

// Point d'entrée unique de la recherche admin (support, 15a) — un champ,
// détection automatique du type de requête. Le préfixe d'ID est le même
// identifiant à 8 caractères déjà affiché partout dans le dashboard business
// (`#A3F92B1C`) — c'est ce qu'un beatmaker colle à Jake en support.
export async function rechercherAdmin(requete: string): Promise<ResultatRechercheAdmin> {
  const q = requete.trim()
  if (!q) return VIDE

  const admin = createAdminClient()
  const motif = `%${q}%`
  const ressemblePrefixeId = /^[0-9a-f]{3,32}$/i.test(q)

  const [beatmakersRes, clientsRes, commandesRes, abonnementsRes] = await Promise.all([
    admin.from('beatmakers').select('id, nom_artiste, slug, email, statut').or(`email.ilike.${motif},slug.ilike.${motif},nom_artiste.ilike.${motif}`).limit(10),
    admin.from('clients').select('id, nom, prenom, email').or(`email.ilike.${motif},nom.ilike.${motif},prenom.ilike.${motif}`).limit(10),
    ressemblePrefixeId ? admin.rpc('admin_chercher_commande_prefixe', { p_prefixe: q }) : Promise.resolve({ data: [] }),
    ressemblePrefixeId ? admin.rpc('admin_chercher_abonnement_prefixe', { p_prefixe: q }) : Promise.resolve({ data: [] }),
  ])

  const commandes = await completerEmailManquant(admin, (commandesRes.data ?? []) as ResultatRechercheAdmin['commandes'])
  const abonnements = await completerEmailManquant(admin, (abonnementsRes.data ?? []) as ResultatRechercheAdmin['abonnements'])

  return {
    beatmakers: beatmakersRes.data ?? [],
    clients: clientsRes.data ?? [],
    commandes,
    abonnements,
  }
}
