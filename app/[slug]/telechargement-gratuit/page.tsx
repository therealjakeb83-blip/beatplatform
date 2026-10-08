import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import ConfirmationFreeDownload from './ConfirmationFreeDownload'

export default async function TelechargementGratuitPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { slug } = await params
  const { t } = await searchParams

  const { data: beatmaker } = await createAdminClient()
    .from('beatmakers')
    .select('nom_artiste')
    .eq('slug', slug)
    .maybeSingle()
  if (!beatmaker) notFound()

  return <ConfirmationFreeDownload slug={slug} nomArtiste={beatmaker.nom_artiste} jeton={t ?? ''} />
}
