import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { RECETTES, categorieDepuisSlug } from '../_lib/recettes'
import type { AutomatisationRow } from '../_lib/types'
import { sauvegarderAutomatisation } from '../_lib/actions'
import RecetteCard from '../_components/RecetteCard'

export default async function CategorieAutomatisationsPage({
  params,
}: {
  params: Promise<{ categorie: string }>
}) {
  const { categorie: slug } = await params
  const categorie = categorieDepuisSlug(slug)
  if (!categorie) notFound()

  const recettesCategorie = RECETTES.filter(r => r.categorie === categorie)
  if (recettesCategorie.length === 0) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data } = await supabase
    .from('automatisations')
    .select('id, type, actif, objet, corps, delai_heures, heure_cible_minutes')
    .eq('beatmaker_id', user.id)

  const automatisations = (data ?? []) as AutomatisationRow[]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <div>
          <Link
            href="/dashboard/business/marketing/automatisations"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Automatisations
          </Link>
          <h1 className="text-xl font-bold text-white mt-1">{categorie}</h1>
        </div>

        <div className="space-y-3">
          {recettesCategorie.map(recette => (
            <RecetteCard
              key={recette.type}
              recette={recette}
              existante={automatisations.find(a => a.type === recette.type)}
              sauvegarder={sauvegarderAutomatisation}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
