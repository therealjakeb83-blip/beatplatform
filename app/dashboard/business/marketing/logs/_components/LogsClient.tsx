'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { EmailLogRow } from '../page'
import RenvoyerLogButton from './RenvoyerLogButton'
import { messageErreurNaturel } from '@/lib/email-erreurs'

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  transactionnel: { label: 'Transactionnel', cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' },
  automatisation: { label: 'Automatisation',  cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
}

const EVENEMENT_LABEL: Record<string, string> = {
  invitation_collab:        'Invitation collab',
  fonds_en_attente:         'Fonds en attente',
  rappel_fonds:             'Rappel fonds',
  confirmation_expiration:  'Confirmation expiration',
  renvoi_commande:          'Renvoi commande',
  telechargement_gratuit:   'Téléchargement gratuit',
}

function labelEvenement(ev: string): string {
  if (EVENEMENT_LABEL[ev]) return EVENEMENT_LABEL[ev]
  if (ev.startsWith('automatisation_')) {
    return `Automatisation — ${ev.replace('automatisation_', '').replace(/_/g, ' ')}`
  }
  return ev
}

function fmtDateHeure(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function BadgeStatut({ statut }: { statut: 'envoye' | 'echoue' }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      statut === 'envoye'
        ? 'bg-green-500/15 text-green-400 border border-green-500/20'
        : 'bg-red-500/15 text-red-400 border border-red-500/20'
    }`}>
      {statut === 'envoye' ? 'Envoyé' : 'Échoué'}
    </span>
  )
}

function MessageApercu({ log }: { log: EmailLogRow }) {
  if (!log.corps_html && !log.corps_texte) return null

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Message</p>
      {log.corps_html ? (
        <iframe
          srcDoc={log.corps_html}
          sandbox=""
          className="w-full h-72 bg-white rounded-lg border border-gray-700"
          title="Aperçu de l'email"
        />
      ) : (
        <pre className="text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
          {log.corps_texte}
        </pre>
      )}
    </div>
  )
}

function DetailModal({ log, onClose }: { log: EmailLogRow; onClose: () => void }) {
  const t = TYPE_LABEL[log.type]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t?.cls ?? 'bg-gray-700 text-gray-300'}`}>
              {t?.label ?? log.type}
            </span>
            <BadgeStatut statut={log.statut} />
          </div>
          <div className="flex items-center gap-2">
            {(log.corps_html || log.corps_texte) && <RenvoyerLogButton logId={log.id} />}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Destinataire</p>
            <p className="text-sm text-white">{log.destinataire}</p>
            {log.clients && (
              <Link
                href={`/dashboard/business/contacts/${log.clients.id}`}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                {[log.clients.prenom, log.clients.nom].filter(Boolean).join(' ')} →
              </Link>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sujet</p>
            <p className="text-sm text-white">{log.sujet}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">Événement</p>
              <p className="text-xs text-gray-300">{labelEvenement(log.evenement)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">Date d&apos;envoi</p>
              <p className="text-xs text-gray-300">{fmtDateHeure(log.created_at)}</p>
            </div>
            {log.ouvert_at && (
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Ouvert</p>
                <p className="text-xs text-gray-300">{fmtDateHeure(log.ouvert_at)}</p>
              </div>
            )}
            {log.clique_at && (
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Cliqué</p>
                <p className="text-xs text-gray-300">{fmtDateHeure(log.clique_at)}</p>
              </div>
            )}
            {log.commande_id && (
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Commande</p>
                <Link
                  href={`/dashboard/business/commandes/${log.commande_id}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-mono"
                >
                  #{log.commande_id.slice(0, 8).toUpperCase()}
                </Link>
              </div>
            )}
          </div>

          {log.erreur && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1">Erreur</p>
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3 whitespace-pre-wrap break-words">
                {messageErreurNaturel(log.erreur)}
              </p>
            </div>
          )}

          <MessageApercu log={log} />
        </div>
      </div>
    </div>
  )
}

type Props = {
  logs: EmailLogRow[]
  counts: { tous: number; envoye: number; echoue: number }
  page: number
  totalPages: number
  filtreStatut: string
  filtreType: string
  q: string
  scope: string
}

const SCOPES = [
  { value: 'destinataire', label: 'Destinataire' },
  { value: 'sujet',        label: 'Sujet' },
  { value: 'message',      label: 'Message' },
]

const TABS: Array<{ value: string; label: string; key: 'tous' | 'envoye' | 'echoue' }> = [
  { value: '',        label: 'Tous',     key: 'tous' },
  { value: 'envoye',  label: 'Réussis',  key: 'envoye' },
  { value: 'echoue',  label: 'Échoués',  key: 'echoue' },
]

export default function LogsClient({ logs, counts, page, totalPages, filtreStatut, filtreType, q, scope }: Props) {
  const [detail, setDetail] = useState<EmailLogRow | null>(null)

  function hrefAvec(overrides: Record<string, string>) {
    const merged: Record<string, string> = { statut: filtreStatut, type: filtreType, q, scope, page: '1', ...overrides }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Logs emails</h1>
          <p className="text-sm text-gray-500 mt-0.5">{counts.tous} résultat{counts.tous !== 1 ? 's' : ''}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {TABS.map(tab => (
            <Link
              key={tab.value}
              href={hrefAvec({ statut: tab.value })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtreStatut === tab.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${filtreStatut === tab.value ? 'text-gray-400' : 'text-gray-600'}`}>
                {counts[tab.key]}
              </span>
            </Link>
          ))}
        </div>

        {/* Toolbar */}
        <form className="flex flex-wrap items-center gap-3" action="" method="GET">
          {filtreStatut && <input type="hidden" name="statut" value={filtreStatut} />}

          <div className="flex items-center gap-0 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <select
              name="scope"
              defaultValue={scope}
              className="bg-gray-800 text-xs text-gray-400 px-3 py-2 border-r border-gray-700 outline-none cursor-pointer"
            >
              {SCOPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="flex items-center px-3 py-2 gap-2 flex-1 min-w-[220px]">
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Rechercher..."
                className="bg-transparent text-sm text-white placeholder-gray-600 outline-none flex-1"
              />
            </div>
          </div>

          <select
            name="type"
            defaultValue={filtreType}
            onChange={e => e.currentTarget.form?.requestSubmit()}
            className="bg-gray-900 border border-gray-800 text-sm text-gray-400 px-3 py-2 rounded-xl outline-none cursor-pointer"
          >
            <option value="">Type</option>
            <option value="transactionnel">Transactionnel</option>
            <option value="automatisation">Automatisation</option>
          </select>

          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Rechercher
          </button>

          {(filtreType || q) && (
            <Link href={hrefAvec({ type: '', q: '' })} className="text-xs text-gray-500 hover:text-gray-300 underline">
              Tout effacer
            </Link>
          )}
        </form>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-600 text-sm">Aucun email</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Destinataire</th>
                    <th className="text-left px-4 py-3">Sujet</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Statut</th>
                    <th className="text-left px-4 py-3">Erreur</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {logs.map(log => {
                    const t = TYPE_LABEL[log.type]
                    return (
                      <tr key={log.id} className="hover:bg-gray-800/40 transition-colors group">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDateHeure(log.created_at)}</td>
                        <td className="px-4 py-3 text-white">{log.destinataire}</td>
                        <td className="px-4 py-3 text-gray-300 max-w-[280px] truncate">{log.sujet}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t?.cls ?? 'bg-gray-700 text-gray-300'}`}>
                            {t?.label ?? log.type}
                          </span>
                          <div className="text-[10px] text-gray-600 mt-0.5">{labelEvenement(log.evenement)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <BadgeStatut statut={log.statut} />
                        </td>
                        <td className="px-4 py-3 text-xs text-red-300 max-w-[220px] truncate" title={messageErreurNaturel(log.erreur) ?? undefined}>
                          {messageErreurNaturel(log.erreur) ?? <span className="text-gray-700">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {(log.corps_html || log.corps_texte) && <RenvoyerLogButton logId={log.id} />}
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
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Link
              href={hrefAvec({ page: String(Math.max(1, page - 1)) })}
              className={`px-3 py-1.5 rounded-lg text-sm ${page <= 1 ? 'text-gray-700 pointer-events-none' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
              ← Précédent
            </Link>
            <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
            <Link
              href={hrefAvec({ page: String(Math.min(totalPages, page + 1)) })}
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
