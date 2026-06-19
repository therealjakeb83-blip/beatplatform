import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import CommandesClient from './_components/CommandesClient'

export type CommandeRow = {
  id: string
  created_at: string
  prix_paye: number
  devise: string | null
  statut: 'en_attente' | 'payee' | 'remboursee' | 'litige'
  code_promo: string | null
  reduction_montant: number | null
  fichiers_livres: boolean | null
  source_marketing: string | null
  type_transaction: string | null
  plateforme_source: string | null
  methode_paiement: string | null
  acheteur_email: string | null
  acheteur_nom: string | null
  clients: {
    id: string
    prenom: string | null
    nom: string
    email: string
    pays: string | null
  } | null
  beats: { titre: string; image_url: string | null } | null
  licences: { nom: string; modele: string } | null
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; type?: string }>
}) {
  const { clientId, type } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  // Admin client pour bypasser la RLS de la table clients (join)
  const admin = createAdminClient()

  const { data } = await admin
    .from('commandes')
    .select(
      `id, created_at, prix_paye, devise, statut,
       code_promo, reduction_montant, fichiers_livres,
       source_marketing, type_transaction, plateforme_source,
       acheteur_email, acheteur_nom, methode_paiement,
       clients (id, prenom, nom, email, pays),
       beats (titre, image_url),
       licences (nom, modele)`
    )
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <CommandesClient
      commandes={(data ?? []) as unknown as CommandeRow[]}
      initialClientId={clientId}
      initialType={type}
    />
  )
}
