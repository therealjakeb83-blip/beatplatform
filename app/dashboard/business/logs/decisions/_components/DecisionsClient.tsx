'use client'

import Link from 'next/link'
import type { DecisionLogRow } from '../page'

const ACTOR_LABEL: Record<string, { label: string; cls: string }> = {
  beatmaker: { label: 'Toi', cls: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' },
  admin:     { label: 'My Producer', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
}

const ENTITY_LABEL: Record<string, string> = {
  commande:       'Commande',
  boutique:       'Boutique',
  page_legale:    'Page légale',
  licence_texte:  'Licence',
}

const ACTION_LABEL: Record<string, string> = {
  remboursement:       'Remboursement',
  suspension:          'Suspension',
  reactivation:        'Réactivation',
  publication:         'Publication',
  modification_texte:  'Modification du texte',
}

function fmtDateHeure(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const ENTITY_FILTERS = [
  { value: '',               label: 'Toutes' },
  { value: 'commande',       label: 'Commandes' },
  { value: 'boutique',       label: 'Boutique' },
  { value: 'page_legale',    label: 'Pages légales' },
  { value: 'licence_texte',  label: 'Licences' },
]

function hrefEntite(entity: string) {
  const params = new URLSearchParams()
  if (entity) params.set('entity_type', entity)
  const qs = params.toString()
  return qs ? `?${qs}` : '?'
}

function LienEntite({ log }: { log: DecisionLogRow }) {
  if (log.entity_type === 'commande') {
    return (
      <Link href={`/dashboard/business/commandes/${log.entity_id}`} className="text-indigo-400 hover:text-indigo-300 font-mono text-xs">
        #{log.entity_id.slice(0, 8).toUpperCase()}
      </Link>
    )
  }
  if (log.entity_type === 'licence_texte') {
    return (
      <Link href={`/dashboard/business/licences/${log.entity_id}/texte`} className="text-indigo-400 hover:text-indigo-300 text-xs">
        Voir la licence →
      </Link>
    )
  }
  return <span className="text-xs text-gray-600">—</span>
}

type Props = {
  logs: DecisionLogRow[]
  total: number
  page: number
  totalPages: number
  filtreEntite: string
}

export default function DecisionsClient({ logs, total, page, totalPages, filtreEntite }: Props) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        <div>
          <h1 className="text-xl font-bold text-white">Décisions commerciales/juridiques</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} décision{total !== 1 ? 's' : ''} enregistrée{total !== 1 ? 's' : ''} sur ta boutique — historique permanent, jamais modifiable.
          </p>
        </div>

        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
          {ENTITY_FILTERS.map(f => (
            <Link
              key={f.value}
              href={hrefEntite(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtreEntite === f.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-600 text-sm">Aucune décision enregistrée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Décidé par</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-left px-4 py-3">Concerne</th>
                    <th className="text-left px-4 py-3">Motif</th>
                    <th className="text-right px-4 py-3">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {logs.map(log => {
                    const acteur = ACTOR_LABEL[log.actor_type]
                    return (
                      <tr key={log.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDateHeure(log.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acteur?.cls ?? 'bg-gray-700 text-gray-300'}`}>
                            {acteur?.label ?? log.actor_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white">
                          {ACTION_LABEL[log.action] ?? log.action}
                          {log.reference_version && (
                            <span className="text-[10px] text-gray-600 ml-1.5">v{log.reference_version}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
                          <span className="ml-2"><LienEntite log={log} /></span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300 max-w-[280px] truncate" title={log.motif ?? undefined}>
                          {log.motif ?? <span className="text-gray-700">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-[10px] text-gray-600">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Link
              href={`?entity_type=${filtreEntite}&page=${Math.max(1, page - 1)}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${page <= 1 ? 'text-gray-700 pointer-events-none' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              ← Précédent
            </Link>
            <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
            <Link
              href={`?entity_type=${filtreEntite}&page=${Math.min(totalPages, page + 1)}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${page >= totalPages ? 'text-gray-700 pointer-events-none' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              Suivant →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
