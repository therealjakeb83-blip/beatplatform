import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { CategorieRow } from '@/lib/categories'
import { demanderCertification, annulerDemandeCertification, supprimerCategoriePersonnelle } from './_lib/actions'
import CategoriesClient from './_components/CategoriesClient'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: categoriesRaw } = await supabase
    .from('categories')
    .select('id, type, nom, source, beatmaker_id, statut')
    .order('nom')
  const categories = (categoriesRaw ?? []) as CategorieRow[]

  return (
    <CategoriesClient
      categories={categories}
      beatmakerId={user.id}
      demanderCertification={demanderCertification}
      annulerDemandeCertification={annulerDemandeCertification}
      supprimerCategoriePersonnelle={supprimerCategoriePersonnelle}
    />
  )
}
