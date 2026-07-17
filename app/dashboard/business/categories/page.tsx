import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import type { CategorieRow } from '@/lib/categories'
import {
  estModerateur,
  demanderCertification,
  annulerDemandeCertification,
  supprimerCategoriePersonnelle,
  approuverCertification,
  rejeterCertification,
} from './_lib/actions'
import CategoriesClient from './_components/CategoriesClient'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: categoriesRaw }, moderateur] = await Promise.all([
    supabase.from('categories').select('id, type, nom, source, beatmaker_id, statut').order('nom'),
    estModerateur(),
  ])
  const categories = (categoriesRaw ?? []) as CategorieRow[]

  // Demandes en attente PLATEFORME-WIDE — la RLS ne remonte que ses propres
  // demandes au beatmaker normal, il faut le service_role pour la vue
  // modération. Vide si non modérateur (pas de round-trip inutile).
  let demandesEnAttente: (CategorieRow & { nom_artiste: string | null })[] = []
  if (moderateur) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('categories')
      .select('id, type, nom, source, beatmaker_id, statut, beatmakers(nom_artiste)')
      .eq('statut', 'en_attente_certification')
      .order('nom')
    demandesEnAttente = ((data ?? []) as unknown as (CategorieRow & { beatmakers: { nom_artiste: string } | null })[])
      .map(d => ({ ...d, nom_artiste: d.beatmakers?.nom_artiste ?? null }))
  }

  return (
    <CategoriesClient
      categories={categories}
      beatmakerId={user.id}
      moderateur={moderateur}
      demandesEnAttente={demandesEnAttente}
      demanderCertification={demanderCertification}
      annulerDemandeCertification={annulerDemandeCertification}
      supprimerCategoriePersonnelle={supprimerCategoriePersonnelle}
      approuverCertification={approuverCertification}
      rejeterCertification={rejeterCertification}
    />
  )
}
