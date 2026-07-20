import { createAdminClient } from '@/utils/supabase/admin'
import type { CategorieRow } from '@/lib/categories'
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
  const { data } = await admin
    .from('categories')
    .select('id, type, nom, source, beatmaker_id, statut, beatmakers(nom_artiste)')
    .order('nom')

  const categories = ((data ?? []) as unknown as (CategorieRow & { beatmakers: { nom_artiste: string } | null })[])
    .map(c => ({ ...c, nom_artiste: c.beatmakers?.nom_artiste ?? null }))

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
