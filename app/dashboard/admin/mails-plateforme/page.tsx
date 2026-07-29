import { createAdminClient } from '@/utils/supabase/admin'
import { sauvegarderTemplatePlateforme, genererApercuPlateforme } from './_lib/actions'
import MailsPlateformeClient from './_components/MailsPlateformeClient'
import LogsPlateformeClient, { type LogPlateformeRow } from './_components/LogsPlateformeClient'
import type { TypeTemplatePlateforme } from '@/lib/emails'
import Link from 'next/link'

const TYPES: TypeTemplatePlateforme[] = ['confirmation_email', 'bienvenue', 'confirmation_essai', 'rappel_fin_essai', 'paiement_echoue', 'annulation']

const PAGE_SIZE = 50

const SCOPES = ['destinataire', 'sujet', 'message'] as const
type Scope = typeof SCOPES[number]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appliquerFiltres(query: any, evenement?: string, q?: string, scope?: string) {
  let qy = query.like('evenement', 'plateforme_%')
  if (evenement) qy = qy.eq('evenement', evenement)
  if (q) {
    const like = `%${q.replace(/,/g, ' ')}%`
    if (scope === 'sujet') qy = qy.ilike('sujet', like)
    else if (scope === 'message') qy = qy.or(`corps_html.ilike.${like},corps_texte.ilike.${like}`)
    else qy = qy.ilike('destinataire', like)
  }
  return qy
}

export default async function MailsPlateformePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; statut?: string; evenement?: string; q?: string; scope?: string }>
}) {
  const { tab: tabParam, page: pageParam, statut, evenement, q, scope: scopeParam } = await searchParams
  const tab = tabParam === 'logs' ? 'logs' : 'reglages'
  const admin = createAdminClient()

  if (tab === 'logs') {
    const page = Math.max(1, parseInt(pageParam ?? '1') || 1)
    const scope: Scope = SCOPES.includes(scopeParam as Scope) ? (scopeParam as Scope) : 'destinataire'

    const [{ count: totalCount }, { count: envoyeCount }, { count: echoueCount }] = await Promise.all([
      appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), evenement, q, scope),
      appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), evenement, q, scope).eq('statut', 'envoye'),
      appliquerFiltres(admin.from('email_logs').select('id', { count: 'exact', head: true }), evenement, q, scope).eq('statut', 'echoue'),
    ])

    let requetePage = appliquerFiltres(
      admin.from('email_logs').select(`
        id, created_at, destinataire, sujet, evenement, statut, erreur,
        ouvert_at, clique_at, corps_html, corps_texte,
        beatmakers (id, nom_artiste, slug)
      `),
      evenement, q, scope,
    )
    if (statut === 'envoye' || statut === 'echoue') requetePage = requetePage.eq('statut', statut)

    const offset = (page - 1) * PAGE_SIZE
    const { data } = await requetePage
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE))

    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <Onglets actif={tab} />
        <LogsPlateformeClient
          logs={(data ?? []) as unknown as LogPlateformeRow[]}
          counts={{ tous: totalCount ?? 0, envoye: envoyeCount ?? 0, echoue: echoueCount ?? 0 }}
          page={page}
          totalPages={totalPages}
          filtreStatut={statut ?? ''}
          filtreEvenement={evenement ?? ''}
          q={q ?? ''}
          scope={scope}
        />
      </div>
    )
  }

  const { data: templatesRaw } = await admin.from('templates_plateforme').select('type, titre, intro')

  const parType = new Map(
    (templatesRaw ?? []).map(t => [t.type as TypeTemplatePlateforme, { titre: t.titre as string | null, intro: t.intro as string | null }]),
  )
  const templates = Object.fromEntries(
    TYPES.map(type => [type, { titre: parType.get(type)?.titre ?? '', intro: parType.get(type)?.intro ?? '' }]),
  ) as Record<TypeTemplatePlateforme, { titre: string; intro: string }>

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <Onglets actif={tab} />
      <MailsPlateformeClient
        templates={templates}
        sauvegarderTemplate={sauvegarderTemplatePlateforme}
        genererApercu={genererApercuPlateforme}
      />
    </div>
  )
}

function Onglets({ actif }: { actif: 'reglages' | 'logs' }) {
  const items = [
    { value: 'reglages', label: 'Réglages' },
    { value: 'logs', label: 'Logs' },
  ]
  return (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit mb-6">
      {items.map(item => (
        <Link
          key={item.value}
          href={item.value === 'reglages' ? '?' : `?tab=${item.value}`}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            actif === item.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
