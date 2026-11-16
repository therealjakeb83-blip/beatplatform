import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import ConfirmationNewsletter from './ConfirmationNewsletter'

// Lien de l'email « Confirme ton inscription » (9d lot 3) : adresse
// désinscrite qui redemande la newsletter depuis le formulaire public.
export default async function NewsletterConfirmeePage({
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

  return <ConfirmationNewsletter slug={slug} nomArtiste={beatmaker.nom_artiste} jeton={t ?? ''} />
}
