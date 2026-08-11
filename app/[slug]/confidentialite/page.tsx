import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import PageLegale from '../_components/PageLegale'

export default async function ConfidentialitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  const { data: pageAdoptee } = await admin
    .from('boutique_pages_legales')
    .select('contenu')
    .eq('beatmaker_id', beatmaker.id)
    .eq('type_page', 'confidentialite')
    .maybeSingle()

  const contenu = pageAdoptee?.contenu ?? 'Contenu à compléter.'

  return <PageLegale slug={slug} nomArtiste={beatmaker.nom_artiste} titre="Politique de confidentialité" contenu={contenu} />
}
