import { notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import ClientDetailClient from './_components/ClientDetailClient'
import { corrigerClientAction } from './_lib/actions'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: client } = await admin
    .from('clients')
    .select('id, email, nom, prenom, telephone, langue, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!client) notFound()

  const [{ data: leads }, { data: commandes }] = await Promise.all([
    admin.from('leads').select('beatmaker_id, source, converti, beatmakers(nom_artiste, slug)').eq('client_id', id),
    admin.from('commandes').select('id, beatmaker_id, prix_paye, statut, created_at, beatmakers(nom_artiste)').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  type LeadJoin = { beatmaker_id: string; source: string; converti: boolean; beatmakers: { nom_artiste: string; slug: string } | null }
  type CommandeJoin = { id: string; beatmaker_id: string; prix_paye: number; statut: string; created_at: string; beatmakers: { nom_artiste: string } | null }

  return (
    <ClientDetailClient
      client={client}
      leads={(leads ?? []) as unknown as LeadJoin[]}
      commandes={(commandes ?? []) as unknown as CommandeJoin[]}
      corrigerClientAction={corrigerClientAction}
    />
  )
}
