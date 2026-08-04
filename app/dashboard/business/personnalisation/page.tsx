import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PersonnalisationClient from './_components/PersonnalisationClient'

export default async function PersonnalisationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('slug, nom_artiste, hero_titre, hero_sous_titre, theme_couleur, marque_affichage, style_nom_marque')
    .eq('id', user.id)
    .single()

  if (!beatmaker) redirect('/connexion')

  return (
    <PersonnalisationClient
      slug={beatmaker.slug}
      nomArtiste={beatmaker.nom_artiste}
      heroTitreInitial={beatmaker.hero_titre ?? ''}
      heroSousTitreInitial={beatmaker.hero_sous_titre ?? ''}
      accentInitial={beatmaker.theme_couleur}
      marqueAffichageInitial={beatmaker.marque_affichage}
      styleNomMarqueInitial={beatmaker.style_nom_marque}
    />
  )
}
