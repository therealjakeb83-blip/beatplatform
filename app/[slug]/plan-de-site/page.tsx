import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import PageLegale from '../_components/PageLegale'

export default async function PlanDeSitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('nom_artiste')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  return <PageLegale slug={slug} nomArtiste={beatmaker.nom_artiste} titre="Plan de site" />
}
