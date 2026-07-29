'use client'

import { useState } from 'react'
import Link from 'next/link'
import RenvoyerLogPlateformeButton from './RenvoyerLogPlateformeButton'
import { messageErreurNaturel } from '@/lib/email-erreurs'
import { NOM_PLATEFORME } from '@/lib/constantes'

export type LogPlateformeRow = {
  id: string
  created_at: string
  destinataire: string
  sujet: string
  evenement: string
  statut: 'envoye' | 'echoue'
  erreur: string | null
  ouvert_at: string | null
  clique_at: string | null
  corps_html: string | null
  corps_texte: string | null
  beatmakers: { id: string; nom_artiste: string; slug: string } | null
}

const EVENEMENT_LABEL: Record<string, string> = {
  plateforme_confirmation_email: "Confirmation d'adresse email",
  plateforme_bienvenue: 'Bienvenue',
  plateforme_confirmation_essai: 'Confirmation essai',
  plateforme_rappel_fin_essai: "Rappel fin d'essai",
  plateforme_paiement_echoue: 'Paiement échoué',
  plateforme_annulation: 'Annulation',
}

function labelEvenement(ev: string): string {
  return EVENEMENT_LABEL[ev] ?? ev
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

function MessageApercu({ log }: { log: LogPlateformeRow }) {
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

function DetailModal({ log, onClose }: { log: LogPlateformeRow; onClose: () => void }) {
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
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              {labelEvenement(log.evenement)}
            </span>
            <BadgeStatut statut={log.statut} />
          </div>
          <div className="flex items-center gap-2">
            {(log.corps_html || log.corps_texte) && <RenvoyerLogPlateformeButton logId={log.id} />}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Beatmaker</p>
            {log.beatmakers ? (
              <Link
                href={`/dashboard/admin/boutiques/${log.beatmakers.id}`}
                className="text-sm text-indigo-400 hover:text-indigo-300"
              >
                {log.beatmakers.nom_artiste} →
              </Link>
            ) : (
              <p className="text-sm text-gray-500">—</p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Destinataire</p>
            <p className="text-sm text-white">{log.destinataire}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sujet</p>
            <p className="text-sm text-white">{log.sujet}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
  logs: LogPlateformeRow[]
  counts: { tous: number; envoye: number; echoue: number }
  page: number
  totalPages: number
  filtreStatut: string
  filtreEvenement: string
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

export default function LogsPlateformeClient({ logs, counts, page, totalPages, filtreStatut, filtreEvenement, q, scope }: Props) {
  const [detail, setDetail] = useState<LogPlateformeRow | null>(null)

  function hrefAvec(overrides: Record<string, string>) {
    const merged: Record<string, string> = { tab: 'logs', statut: filtreStatut, evenement: filtreEvenement, q, scope, page: '1', ...overrides }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    return `?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Logs — Mails {NOM_PLATEFORME}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{counts.tous} résultat{counts.tous !== 1 ? 's' : ''} — emails plateforme→beatmaker uniquement</p>
      </div>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <Link
            key={t.value}
            href={hrefAvec({ statut: t.value })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtreStatut === t.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${filtreStatut === t.value ? 'text-gray-400' : 'text-gray-600'}`}>
              {counts[t.key]}
            </span>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-center gap-3" action="" method="GET">
        <input type="hidden" name="tab" value="logs" />
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
          name="evenement"
          defaultValue={filtreEvenement}
          onChange={e => e.currentTarget.form?.requestSubmit()}
          className="bg-gray-900 border border-gray-800 text-sm text-gray-400 px-3 py-2 rounded-xl outline-none cursor-pointer"
        >
          <option value="">Type d&apos;email</option>
          {Object.entries(EVENEMENT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          Rechercher
        </button>

        {(filtreEvenement || q) && (
          <Link href={hrefAvec({ evenement: '', q: '' })} className="text-xs text-gray-500 hover:text-gray-300 underline">
            Tout effacer
          </Link>
        )}
      </form>

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
                  <th className="text-left px-4 py-3">Beatmaker</th>
                  <th className="text-left px-4 py-3">Destinataire</th>
                  <th className="text-left px-4 py-3">Type d&apos;email</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Erreur</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDateHeure(log.created_at)}</td>
                    <td className="px-4 py-3 text-white">
                      {log.beatmakers ? (
                        <Link href={`/dashboard/admin/boutiques/${log.beatmakers.id}`} className="hover:text-indigo-400">
                          {log.beatmakers.nom_artiste}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{log.destinataire}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                        {labelEvenement(log.evenement)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatut statut={log.statut} />
                    </td>
                    <td className="px-4 py-3 text-xs text-red-300 max-w-[220px] truncate" title={messageErreurNaturel(log.erreur) ?? undefined}>
                      {messageErreurNaturel(log.erreur) ?? <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(log.corps_html || log.corps_texte) && <RenvoyerLogPlateformeButton logId={log.id} />}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {detail && <DetailModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
