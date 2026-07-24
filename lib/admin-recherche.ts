import { createAdminClient } from '@/utils/supabase/admin'

export type ResultatRechercheAdmin = {
  beatmakers: { id: string; nom_artiste: string; slug: string; email: string; statut: string }[]
  clients: { id: string; nom: string; prenom: string; email: string }[]
  commandes: { id: string; beatmaker_id: string; acheteur_email: string | null; prix_paye: number; statut: string; created_at: string }[]
  abonnements: { id: string; beatmaker_id: string; client_id: string; acheteur_email: string | null; statut: string; created_at: string }[]
}

const VIDE: ResultatRechercheAdmin = { beatmakers: [], clients: [], commandes: [], abonnements: [] }

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

  return {
    beatmakers: beatmakersRes.data ?? [],
    clients: clientsRes.data ?? [],
    commandes: (commandesRes.data ?? []) as ResultatRechercheAdmin['commandes'],
    abonnements: (abonnementsRes.data ?? []) as ResultatRechercheAdmin['abonnements'],
  }
}
