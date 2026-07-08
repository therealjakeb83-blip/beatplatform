import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import LogsClient from './_components/LogsClient'

export type EmailLogRow = {
  id: string
  created_at: string
  destinataire: string
  sujet: string
  type: 'transactionnel' | 'campagne' | 'automatisation'
  evenement: string
  statut: 'envoye' | 'echoue'
  erreur: string | null
  ouvert_at: string | null
  clique_at: string | null
  commande_id: string | null
  campagne_id: string | null
  automatisation_id: string | null
  clients: { id: string; prenom: string | null; nom: string } | null
}

const PAGE_SIZE = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appliquerFiltres(query: any, beatmakerId: string, type?: string, q?: string) {
  let qy = query.eq('beatmaker_id', beatmakerId)
  if (type) qy = qy.eq('type', type)
  if (q) {
    const like = `%${q.replace(/,/g, ' ')}%`
    qy = qy.or(`destinataire.ilike.${like},sujet.ilike.${like}`)
  }
  return qy
}

export default async function LogsEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; statut?: string; type?: string; q?: string }>
}) {
  const { page: pageParam, statut, type, q } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1') || 1)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const [{ count: totalCount }, { count: envoyeCount }, { count: echoueCount }] = await Promise.all([
    appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), user.id, type, q),
    appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), user.id, type, q).eq('statut', 'envoye'),
    appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), user.id, type, q).eq('statut', 'echoue'),
  ])

  let requetePage = appliquerFiltres(
    admin.from('email_logs').select(`
      id, created_at, destinataire, sujet, type, evenement, statut, erreur,
      ouvert_at, clique_at, commande_id, campagne_id, automatisation_id,
      clients (id, prenom, nom)
    `),
    user.id, type, q,
  )
  if (statut === 'envoye' || statut === 'echoue') requetePage = requetePage.eq('statut', statut)

  const offset = (page - 1) * PAGE_SIZE
  const { data } = await requetePage
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE))

  return (
    <LogsClient
      logs={(data ?? []) as unknown as EmailLogRow[]}
      counts={{ tous: totalCount ?? 0, envoye: envoyeCount ?? 0, echoue: echoueCount ?? 0 }}
      page={page}
      totalPages={totalPages}
      filtreStatut={statut ?? ''}
      filtreType={type ?? ''}
      q={q ?? ''}
    />
  )
}
