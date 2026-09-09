'use client'

import { useState } from 'react'
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

function DetailModal({ log, onClose }: { log: DecisionLogRow; onClose: () => void }) {
  const acteur = ACTOR_LABEL[log.actor_type]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acteur?.cls ?? 'bg-gray-700 text-gray-300'}`}>
              {acteur?.label ?? log.actor_type}
            </span>
            <span className="text-sm text-white font-semibold">{ACTION_LABEL[log.action] ?? log.action}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Date</p>
              <p className="text-sm text-gray-300">{fmtDateHeure(log.created_at)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Action brute</p>
              <p className="text-sm text-gray-300 font-mono">{log.action}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Concerne</p>
              <p className="text-sm text-gray-300">{ENTITY_LABEL[log.entity_type] ?? log.entity_type}</p>
            </div>
            {log.reference_version && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Version</p>
                <p className="text-sm text-gray-300">v{log.reference_version}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Élément concerné</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">{log.entity_id}</span>
              <LienEntite log={log} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Motif</p>
            <p className="text-sm text-gray-200 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap break-words">
              {log.motif ?? <span className="text-gray-600">Aucun motif renseigné</span>}
            </p>
          </div>

          {log.details && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Détails</p>
              <pre className="text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap break-words overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Identifiant du journal</p>
            <p className="text-xs text-gray-600 font-mono">{log.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

type Props = {
  logs: DecisionLogRow[]
  total: number
  page: number
  totalPages: number
  filtreEntite: string
}

export default function DecisionsClient({ logs, total, page, totalPages, filtreEntite }: Props) {
  const [detail, setDetail] = useState<DecisionLogRow | null>(null)

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
                      <tr key={log.id} onClick={() => setDetail(log)} className="hover:bg-gray-800/40 transition-colors cursor-pointer group">
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
                        <td className="px-4 py-3 text-gray-400" onClick={e => e.stopPropagation()}>
                          {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
                          <span className="ml-2"><LienEntite log={log} /></span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300 max-w-[280px] truncate" title={log.motif ?? undefined}>
                          {log.motif ?? <span className="text-gray-700">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDetail(log)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                            title="Voir le détail"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
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

      {detail && <DetailModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
