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

  const [{ data }, { data: beatsData }, { data: lignesData }, { data: playsData }] = await Promise.all([
    admin.from('categories').select('id, type, nom, source, beatmaker_id, statut, image_url, beatmakers(nom_artiste)').order('nom'),
    admin.from('beats').select('id, styles, ambiances, instruments, type_beat'),
    admin.from('commande_lignes')
      .select('beat_id, prix_paye, reduction_montant, commandes!inner(statut)')
      .eq('commandes.statut', 'payee'),
    admin.from('beat_plays').select('beat_id'),
  ])

  const statsParTag = agregerStatsParCategorie(beatsData ?? [], lignesData ?? [], playsData ?? [])

  const categories = ((data ?? []) as unknown as (CategorieRow & { beatmakers: { nom_artiste: string } | null })[])
    .map(c => ({ ...c, nom_artiste: c.beatmakers?.nom_artiste ?? null, ...statsPour(statsParTag, c.type, c.nom) }))

  return (
    <AdminCategoriesClient
      categories={categories}
      approuverCertification={approuverCertification}
      rejeterCertification={rejeterCertification}
      ajouterCategoriePlateforme={ajouterCategoriePlateforme}
      supprimerCategoriePlateforme={supprimerCategoriePlateforme}
    />
  )
}
