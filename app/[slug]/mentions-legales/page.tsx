import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import PageLegale from '../_components/PageLegale'

export default async function MentionsLegalesPage({
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
    .select('contenu, adopte_le')
    .eq('beatmaker_id', beatmaker.id)
    .eq('type_page', 'mentions_legales')
    .maybeSingle()

  const contenu = pageAdoptee?.contenu ?? 'Contenu à compléter.'

  return <PageLegale slug={slug} nomArtiste={beatmaker.nom_artiste} titre="Mentions légales" contenu={contenu} adopteLe={pageAdoptee?.adopte_le} />
}
