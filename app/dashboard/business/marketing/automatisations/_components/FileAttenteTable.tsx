'use client'

import { useState, useTransition } from 'react'
import type { EvenementFileAttente } from '../_lib/types'

type Props = {
  fileAttente: EvenementFileAttente[]
  executerMaintenant: (evenementId: string) => Promise<void>
  previsualiser: (evenementId: string) => Promise<{ objet: string; corpsHtml: string } | { erreur: string }>
  supprimerEvenement: (evenementId: string) => Promise<void>
  executerPlusieurs: (evenementIds: string[]) => Promise<void>
  supprimerPlusieurs: (evenementIds: string[]) => Promise<void>
}

function fmtEcheance(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type ApercuState = { flux: string; client: string } & ({ objet: string; corpsHtml: string } | { erreur: string })

export default function FileAttenteTable({ fileAttente, executerMaintenant, previsualiser, supprimerEvenement, executerPlusieurs, supprimerPlusieurs }: Props) {
  const [enCours, setEnCours] = useState<string | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null)
  const [apercuEnCours, setApercuEnCours] = useState<string | null>(null)
  const [apercu, setApercu] = useState<ApercuState | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [actionGroupeeEnCours, setActionGroupeeEnCours] = useState<'executer' | 'supprimer' | null>(null)

  function handleExecuter(id: string) {
    setEnCours(id)
    startTransition(async () => {
      await executerMaintenant(id)
      setEnCours(null)
    })
  }

  function handleSupprimer(id: string) {
    if (!confirm('Supprimer cet événement de la file d\'attente ? Il ne sera jamais envoyé.')) return
    setSuppressionEnCours(id)
    startTransition(async () => {
      await supprimerEvenement(id)
      setSuppressionEnCours(null)
    })
  }

  function toggleSelection(id: string) {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleToutSelectionner() {
    setSelection(prev => (prev.size === fileAttente.length ? new Set() : new Set(fileAttente.map(e => e.id))))
  }

  function handleExecuterSelection() {
    const ids = [...selection]
    setActionGroupeeEnCours('executer')
    startTransition(async () => {
      await executerPlusieurs(ids)
      setActionGroupeeEnCours(null)
      setSelection(new Set())
    })
  }

  function handleSupprimerSelection() {
    if (!confirm(`Supprimer ${selection.size} événement(s) de la file d'attente ? Ils ne seront jamais envoyés.`)) return
    const ids = [...selection]
    setActionGroupeeEnCours('supprimer')
    startTransition(async () => {
      await supprimerPlusieurs(ids)
      setActionGroupeeEnCours(null)
      setSelection(new Set())
    })
  }

  async function handleVisualiser(e: EvenementFileAttente) {
    setApercuEnCours(e.id)
    const res = await previsualiser(e.id)
    setApercuEnCours(null)
    setApercu({ flux: e.flux, client: `${e.clientNom} (${e.clientEmail})`, ...res })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">File d&apos;attente</p>
          <p className="text-xs text-gray-500 mt-0.5">Événements en attente d&apos;envoi. Vérifiée automatiquement chaque jour — ou exécute un envoi maintenant pour tester.</p>
        </div>
        {selection.size > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">{selection.size} sélectionné{selection.size > 1 ? 's' : ''}</span>
            <button
              onClick={handleExecuterSelection}
              disabled={isPending && actionGroupeeEnCours === 'executer'}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 transition-colors"
            >
              {isPending && actionGroupeeEnCours === 'executer' ? 'Exécution...' : `Exécuter (${selection.size})`}
            </button>
            <button
              onClick={handleSupprimerSelection}
              disabled={isPending && actionGroupeeEnCours === 'supprimer'}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 border border-transparent hover:border-red-500/30 disabled:opacity-50 text-gray-300 hover:text-red-400 transition-colors"
            >
              {isPending && actionGroupeeEnCours === 'supprimer' ? 'Suppression...' : `Supprimer (${selection.size})`}
            </button>
          </div>
        )}
      </div>

      {fileAttente.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-600 text-sm">Aucun événement en attente</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 font-medium">
              <th className="text-left pl-5 pr-2 py-3 w-0">
                <input
                  type="checkbox"
                  checked={selection.size === fileAttente.length}
                  onChange={toggleToutSelectionner}
                  className="rounded border-gray-700 bg-gray-800"
                  aria-label="Tout sélectionner"
                />
              </th>
              <th className="text-left px-2 py-3">Flux de travail</th>
              <th className="text-left px-5 py-3">Client</th>
              <th className="text-left px-5 py-3">Date d&apos;exécution prévue</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {fileAttente.map(e => (
              <tr key={e.id}>
                <td className="pl-5 pr-2 py-3 w-0">
                  <input
                    type="checkbox"
                    checked={selection.has(e.id)}
                    onChange={() => toggleSelection(e.id)}
                    className="rounded border-gray-700 bg-gray-800"
                    aria-label={`Sélectionner ${e.flux}`}
                  />
                </td>
                <td className="px-2 py-3 text-white">{e.flux}</td>
                <td className="px-5 py-3 text-gray-400">
                  {e.clientNom} <span className="text-gray-600">{e.clientEmail}</span>
                </td>
                <td className="px-5 py-3 text-gray-400">{fmtEcheance(e.echeanceISO)}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap space-x-2">
                  <button
                    onClick={() => handleVisualiser(e)}
                    disabled={apercuEnCours === e.id}
                    title="Visualiser"
                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white transition-colors inline-flex"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleExecuter(e.id)}
                    disabled={isPending && enCours === e.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 transition-colors"
                  >
                    {isPending && enCours === e.id ? 'Exécution...' : 'Exécuter maintenant'}
                  </button>
                  <button
                    onClick={() => handleSupprimer(e.id)}
                    disabled={isPending && suppressionEnCours === e.id}
                    title="Supprimer"
                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 border border-transparent hover:border-red-500/30 disabled:opacity-50 text-gray-400 hover:text-red-400 transition-colors inline-flex"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {apercu && <ApercuModal apercu={apercu} onClose={() => setApercu(null)} />}
    </div>
  )
}

function ApercuModal({ apercu, onClose }: { apercu: ApercuState; onClose: () => void }) {
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
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
              {apercu.flux}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">Aperçu</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Destinataire</p>
            <p className="text-sm text-white">{apercu.client}</p>
          </div>

          {'erreur' in apercu ? (
            <p className="text-sm text-red-400">{apercu.erreur}</p>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sujet</p>
                <p className="text-sm text-white">{apercu.objet}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Message</p>
                <iframe
                  srcDoc={apercu.corpsHtml}
                  sandbox=""
                  className="w-full h-72 bg-white rounded-lg border border-gray-700"
                  title="Aperçu de l'email"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
