import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PersonnalisationClient from './_components/PersonnalisationClient'

export default async function PersonnalisationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('slug, hero_titre, hero_sous_titre, theme_couleur')
    .eq('id', user.id)
    .single()

  if (!beatmaker) redirect('/connexion')

  return (
    <PersonnalisationClient
      slug={beatmaker.slug}
      heroTitreInitial={beatmaker.hero_titre ?? ''}
      heroSousTitreInitial={beatmaker.hero_sous_titre ?? ''}
      accentInitial={beatmaker.theme_couleur}
    />
  )
}
