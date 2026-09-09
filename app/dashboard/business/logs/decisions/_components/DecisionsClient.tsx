'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { DecisionLogRow } from '../page'
import { TYPES_PAGES_LEGALES } from '@/lib/pages-legales'

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

const LABEL_PAGE_LEGALE: Record<string, string> = Object.fromEntries(
  TYPES_PAGES_LEGALES.map(p => [p.type, p.titre]),
)

// "Modification ___" — le journal n'enregistre une ligne qu'à la
// publication, donc pas besoin de le préciser dans la phrase.
const RESUME_PAGE_LEGALE: Record<string, string> = {
  cgv:               'des CGV',
  mentions_legales:  'des mentions légales',
  confidentialite:   'de la politique de confidentialité',
  contact:           'de la page contact',
  plan_de_site:      'du plan de site',
}

// Phrase en langage naturel — c'est ce qu'un beatmaker lit en premier,
// pas un couple action/entité technique.
function resumeDecision(log: DecisionLogRow, licenceNoms: Record<string, string>): string {
  const details = (log.details ?? {}) as Record<string, unknown>

  if (log.action === 'remboursement') return `Remboursement de la commande #${log.entity_id.slice(0, 8).toUpperCase()}`
  if (log.action === 'suspension') return "Suspension de la boutique"
  if (log.action === 'reactivation') return "Réactivation de la boutique"
  if (log.action === 'publication' && log.entity_type === 'page_legale') {
    const typePage = typeof details.type_page === 'string' ? details.type_page : ''
    return `Modification ${RESUME_PAGE_LEGALE[typePage] ?? `de "${LABEL_PAGE_LEGALE[typePage] ?? typePage}"`}`
  }
  if (log.action === 'modification_texte' && log.entity_type === 'licence_texte') {
    const nom = licenceNoms[log.entity_id]
    return nom ? `Modification de la licence "${nom}"` : "Modification du texte d'une licence"
  }
  return ACTION_LABEL[log.action] ?? log.action
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

// La comparaison ancien/nouveau texte n'a de sens que pour les décisions
// qui touchent un document (page légale, licence) — jamais commande/boutique.
const COMPARABLES = ['page_legale', 'licence_texte']

function Comparaison({ log }: { log: DecisionLogRow }) {
  const [etat, setEtat] = useState<'idle' | 'chargement' | 'ok' | 'erreur'>('idle')
  const [textes, setTextes] = useState<{ ancien: string | null; nouveau: string | null } | null>(null)

  async function charger() {
    setEtat('chargement')
    try {
      const details = (log.details ?? {}) as Record<string, unknown>
      const params = new URLSearchParams({
        entity_type: log.entity_type,
        entity_id: log.entity_id,
      })
      if (log.reference_version) params.set('reference_version', log.reference_version)
      const versionPrecedente = details.version_precedente
      if (typeof versionPrecedente === 'number') params.set('version_precedente', String(versionPrecedente))
      if (typeof details.type_page === 'string') params.set('type_page', details.type_page)

      const res = await fetch(`/api/business/logs/decisions/comparaison?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTextes(data)
      setEtat('ok')
    } catch {
      setEtat('erreur')
    }
  }

  if (etat === 'idle') {
    return (
      <button
        onClick={charger}
        className="text-xs text-indigo-400 hover:text-indigo-300 underline"
      >
        Voir ce qui a changé
      </button>
    )
  }

  if (etat === 'chargement') return <p className="text-xs text-gray-500">Chargement…</p>
  if (etat === 'erreur') return <p className="text-xs text-red-400">Impossible de charger la comparaison.</p>

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Ancien texte</p>
        <div className="text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
          {textes?.ancien ?? <span className="text-gray-600">Aucune version précédente — c&apos;était la première publication.</span>}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nouveau texte</p>
        <div className="text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
          {textes?.nouveau ?? <span className="text-gray-600">Introuvable (peut-être republié depuis).</span>}
        </div>
      </div>
    </div>
  )
}

function DetailModal({ log, permettreComparaison, licenceNoms, onClose }: { log: DecisionLogRow; permettreComparaison: boolean; licenceNoms: Record<string, string>; onClose: () => void }) {
  const acteur = ACTOR_LABEL[log.actor_type]
  const details = (log.details ?? {}) as Record<string, unknown>
  const versionPrecedente = typeof details.version_precedente === 'number' ? details.version_precedente : null

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
            <span className="text-xs text-gray-500">{fmtDateHeure(log.created_at)}</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <p className="text-base text-white font-medium">{resumeDecision(log, licenceNoms)}</p>

          {log.reference_version && (
            <p className="text-xs text-gray-500">
              Version {versionPrecedente != null ? `${versionPrecedente} → ` : ''}{log.reference_version}
            </p>
          )}

          {log.motif && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Motif</p>
              <p className="text-sm text-gray-200 bg-gray-950 border border-gray-800 rounded-lg p-3 whitespace-pre-wrap break-words">
                {log.motif}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Concerne</p>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
              <LienEntite log={log} />
            </div>
          </div>

          {permettreComparaison && COMPARABLES.includes(log.entity_type) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Ce qui a changé</p>
              <Comparaison log={log} />
            </div>
          )}
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
  permettreComparaison?: boolean
  licenceNoms?: Record<string, string>
}

export default function DecisionsClient({ logs, total, page, totalPages, filtreEntite, permettreComparaison = true, licenceNoms = {} }: Props) {
  const [detail, setDetail] = useState<DecisionLogRow | null>(null)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        <div>
          <h1 className="text-xl font-bold text-white">Décisions commerciales/juridiques</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} décision{total !== 1 ? 's' : ''} enregistrée{total !== 1 ? 's' : ''} — historique permanent, jamais modifiable.
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
                    <th className="text-left px-4 py-3">Quoi</th>
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
                        <td className="px-4 py-3 text-white max-w-[320px] truncate">{resumeDecision(log, licenceNoms)}</td>
                        <td className="px-4 py-3 text-xs text-gray-300 max-w-[220px] truncate" title={log.motif ?? undefined}>
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

      {detail && <DetailModal log={detail} permettreComparaison={permettreComparaison} licenceNoms={licenceNoms} onClose={() => setDetail(null)} />}
    </div>
  )
}
