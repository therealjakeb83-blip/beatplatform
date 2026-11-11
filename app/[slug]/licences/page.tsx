import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import PageLegale from '../_components/PageLegale'
import type { Metadata } from 'next'

// Adresse canonique, relative à l'accueil officiel de la boutique (app/[slug]/layout.tsx).
export const metadata: Metadata = { alternates: { canonical: '/licences' } }

export default async function LicencesPage({
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

  return <PageLegale slug={slug} nomArtiste={beatmaker.nom_artiste} titre="Licences" contenu="Contenu à compléter." />
}
