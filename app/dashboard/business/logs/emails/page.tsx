import { utilisateurConnecte } from '@/lib/session-serveur'
import { remplacerClientsParFiches } from '@/app/dashboard/business/_lib/fiche-boutique'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import LogsClient from './_components/LogsClient'
import { tailleTableaux } from '@/lib/pagination-serveur'
import { bornerPage, lirePageAdresse } from '@/lib/pagination'

export type EmailLogRow = {
  id: string
  created_at: string
  destinataire: string
  sujet: string
  type: 'transactionnel' | 'automatisation'
  evenement: string
  statut: 'envoye' | 'echoue'
  erreur: string | null
  ouvert_at: string | null
  clique_at: string | null
  commande_id: string | null
  automatisation_id: string | null
  corps_html: string | null
  corps_texte: string | null
  clients: { id: string; prenom: string | null; nom: string } | null
}


const SCOPES = ['destinataire', 'sujet', 'message'] as const
type Scope = typeof SCOPES[number]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appliquerFiltres(query: any, beatmakerId: string, type?: string, q?: string, scope?: string) {
  let qy = query.eq('beatmaker_id', beatmakerId)
  if (type) qy = qy.eq('type', type)
  if (q) {
    const like = `%${q.replace(/,/g, ' ')}%`
    if (scope === 'sujet') qy = qy.ilike('sujet', like)
    else if (scope === 'message') qy = qy.or(`corps_html.ilike.${like},corps_texte.ilike.${like}`)
    else qy = qy.ilike('destinataire', like)
  }
  return qy
}

export default async function LogsEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; statut?: string; type?: string; q?: string; scope?: string }>
}) {
  const { page: pageParam, statut, type, q, scope: scopeParam } = await searchParams
  const taille = await tailleTableaux()
  const scope: Scope = SCOPES.includes(scopeParam as Scope) ? (scopeParam as Scope) : 'destinataire'

  const user = await utilisateurConnecte()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const [{ count: totalCount }, { count: envoyeCount }, { count: echoueCount }] = await Promise.all([
    appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), user.id, type, q, scope),
    appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), user.id, type, q, scope).eq('statut', 'envoye'),
    appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), user.id, type, q, scope).eq('statut', 'echoue'),
  ])

  let requetePage = appliquerFiltres(
    admin.from('email_logs').select(`
      id, created_at, destinataire, sujet, type, evenement, statut, erreur,
      ouvert_at, clique_at, commande_id, automatisation_id, corps_html, corps_texte, client_id
    `),
    user.id, type, q, scope,
  )
  if (statut === 'envoye' || statut === 'echoue') requetePage = requetePage.eq('statut', statut)

  // Total de l'onglet affiché (avant : toujours « Tous », d'où des pages vides en fin d'onglet Réussis/Échoués)
  const total = (statut === 'envoye' ? envoyeCount : statut === 'echoue' ? echoueCount : totalCount) ?? 0
  const page = bornerPage(lirePageAdresse(pageParam), total, taille)
  const offset = (page - 1) * taille
  const { data } = await requetePage
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + taille - 1)

  // Identité = fiche de CETTE boutique (9d lot 2), jamais la fiche commune
  const logs = await remplacerClientsParFiches(admin, user.id, (data ?? []) as { client_id: string | null }[])

  return (
    <LogsClient
      logs={logs as unknown as EmailLogRow[]}
      counts={{ tous: totalCount ?? 0, envoye: envoyeCount ?? 0, echoue: echoueCount ?? 0 }}
      page={page}
      total={total}
      taille={taille}

      filtreStatut={statut ?? ''}
      filtreType={type ?? ''}
      q={q ?? ''}
      scope={scope}
    />
  )
}
