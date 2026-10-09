import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DecisionsClient from './_components/DecisionsClient'
import { tailleTableaux } from '@/lib/pagination-serveur'
import { bornerPage, lirePageAdresse } from '@/lib/pagination'

export type DecisionLogRow = {
  id: string
  created_at: string
  actor_type: 'beatmaker' | 'admin'
  entity_type: 'commande' | 'boutique' | 'page_legale' | 'licence_texte' | 'collaboration'
  entity_id: string
  action: string
  motif: string | null
  reference_version: string | null
  details: Record<string, unknown> | null
}


export default async function LogsDecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity_type?: string }>
}) {
  const { page: pageParam, entity_type } = await searchParams
  const taille = await tailleTableaux()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  let requeteCount = supabase
    .from('merchant_decisions_log')
    .select('id', { count: 'exact', head: true })
    .eq('beatmaker_id', user.id)
  if (entity_type) requeteCount = requeteCount.eq('entity_type', entity_type)
  const { count: totalCount } = await requeteCount

  let requetePage = supabase
    .from('merchant_decisions_log')
    .select('id, created_at, actor_type, entity_type, entity_id, action, motif, reference_version, details')
    .eq('beatmaker_id', user.id)
  if (entity_type) requetePage = requetePage.eq('entity_type', entity_type)

  const page = bornerPage(lirePageAdresse(pageParam), totalCount ?? 0, taille)
  const offset = (page - 1) * taille
  const { data } = await requetePage
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + taille - 1)

  // Pour afficher "Modification de la licence X" plutôt que "cette licence"
  // — le journal ne stocke que l'id, le nom vit dans licences.
  const { data: licences } = await supabase.from('licences').select('id, nom').eq('beatmaker_id', user.id)
  const licenceNoms = Object.fromEntries((licences ?? []).map(l => [l.id, l.nom]))

  return (
    <DecisionsClient
      logs={(data ?? []) as DecisionLogRow[]}
      total={totalCount ?? 0}
      page={page}
      taille={taille}

      filtreEntite={entity_type ?? ''}
      licenceNoms={licenceNoms}
    />
  )
}
