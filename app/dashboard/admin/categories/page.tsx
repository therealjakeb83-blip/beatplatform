import { createAdminClient } from '@/utils/supabase/admin'
import type { CategorieRow } from '@/lib/categories'
import { agregerStatsParCategorie, statsPour } from '@/lib/categories-stats'
import {
  approuverCertification,
  rejeterCertification,
  ajouterCategoriePlateforme,
  supprimerCategoriePlateforme,
} from './_lib/actions'
import AdminCategoriesClient from './_components/AdminCategoriesClient'

export default async function AdminCategoriesPage() {
  // Vue plateforme-wide (toutes boutiques) — nécessite le service_role, la
  // RLS d'un beatmaker (même admin) ne remonte que ses propres catégories
  // perso en plus du catalogue plateforme/certifié.
  const admin = createAdminClient()

  const [{ data }, { data: demandesRaw }, { data: beatsData }, { data: lignesData }, { data: playsData }] = await Promise.all([
    admin.from('categories').select('id, type, nom, source, beatmaker_id, statut, image_url, beatmakers(nom_artiste)').order('nom'),
    // Demandes en attente : table dédiée (Phase 7.9), pas categories.statut —
    // garde l'historique des rejets au lieu de le perdre.
    admin.from('demandes_certification')
      .select('id, categorie_id, categories(nom, type), beatmakers(nom_artiste)')
      .eq('statut', 'en_attente'),
    admin.from('beats').select('id, styles, ambiances, instruments, type_beat'),
    admin.from('commande_lignes')
      .select('beat_id, prix_paye, reduction_montant, commandes!inner(statut)')
      .eq('commandes.statut', 'payee'),
    admin.from('beat_plays').select('beat_id'),
  ])

  const statsParTag = agregerStatsParCategorie(beatsData ?? [], lignesData ?? [], playsData ?? [])

  const categories = ((data ?? []) as unknown as (CategorieRow & { beatmakers: { nom_artiste: string } | null })[])
    .map(c => ({ ...c, nom_artiste: c.beatmakers?.nom_artiste ?? null, ...statsPour(statsParTag, c.type, c.nom) }))

  type DemandeJoin = { id: string; categorie_id: string; categories: { nom: string; type: CategorieRow['type'] } | null; beatmakers: { nom_artiste: string } | null }
  const demandes = ((demandesRaw ?? []) as unknown as DemandeJoin[])
    .filter(d => d.categories)
    .map(d => ({
      id: d.id,
      categorie_id: d.categorie_id,
      nom: d.categories!.nom,
      type: d.categories!.type,
      nom_artiste: d.beatmakers?.nom_artiste ?? null,
      ...statsPour(statsParTag, d.categories!.type, d.categories!.nom),
    }))

  return (
    <AdminCategoriesClient
      categories={categories}
      demandes={demandes}
      approuverCertification={approuverCertification}
      rejeterCertification={rejeterCertification}
      ajouterCategoriePlateforme={ajouterCategoriePlateforme}
      supprimerCategoriePlateforme={supprimerCategoriePlateforme}
    />
  )
}
