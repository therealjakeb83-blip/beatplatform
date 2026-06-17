'use client'

import { useState } from 'react'
import Link from 'next/link'
import { couleurCls, type SegmentDB, type CatalogOptions } from '../../_lib/segments'
import SegmentModal from './SegmentModal'

type Props = {
  segments: (SegmentDB & { count: number })[]
  catalog: CatalogOptions
  creerSegment:    (fd: FormData) => Promise<void>
  modifierSegment:  (fd: FormData) => Promise<void>
  supprimerSegment: (fd: FormData) => Promise<void>
}

export default function SegmentsClient({ segments, catalog, creerSegment, modifierSegment, supprimerSegment }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<(SegmentDB & { count: number }) | null>(null)

  async function handleCreate(fd: FormData) {
    await creerSegment(fd)
    setShowCreate(false)
  }

  async function handleEdit(fd: FormData) {
    await modifierSegment(fd)
    setEditTarget(null)
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">Segments</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Listes dynamiques — recalculées automatiquement à chaque ouverture
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            + Nouveau segment
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <p className="text-gray-500 text-sm mb-1">Aucun segment créé</p>
              <p className="text-gray-700 text-xs mb-6">
                Crée ton premier segment pour filtrer tes contacts par critères
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
              >
                + Créer un segment
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {segments.map(seg => (
                <div
                  key={seg.id}
                  className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <Link href={`/dashboard/business/segments/${seg.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${couleurCls(seg.couleur)}`}>
                          {seg.count} contact{seg.count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="font-semibold text-white text-sm group-hover:text-indigo-300 transition-colors">
                        {seg.nom}
                      </p>
                      {seg.description && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{seg.description}</p>
                      )}
                      {seg.filtres.length > 0 && (
                        <p className="text-[10px] text-gray-700 mt-2">
                          {seg.filtres.length} critère{seg.filtres.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </Link>

                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Modifier */}
                      <button
                        onClick={() => setEditTarget(seg)}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Modifier"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
                          <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9a.75.75 0 0 1 1.5 0v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                        </svg>
                      </button>

                      {/* Supprimer */}
                      <form action={supprimerSegment}>
                        <input type="hidden" name="id" value={seg.id} />
                        <button
                          type="submit"
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
                          title="Supprimer"
                          onClick={e => {
                            if (!confirm(`Supprimer "${seg.nom}" ?`)) e.preventDefault()
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </form>

                      {/* Voir */}
                      <Link
                        href={`/dashboard/business/segments/${seg.id}`}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-indigo-400 transition-colors"
                        title="Voir les contacts"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M2 8c0 .414.336.75.75.75h8.69l-1.22 1.22a.75.75 0 1 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 1 0-1.06 1.06l1.22 1.22H2.75A.75.75 0 0 0 2 8Z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal création */}
      {showCreate && (
        <SegmentModal
          catalog={catalog}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {/* Modal édition */}
      {editTarget && (
        <SegmentModal
          catalog={catalog}
          segmentId={editTarget.id}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
          initial={{
            nom:         editTarget.nom,
            description: editTarget.description ?? '',
            couleur:     editTarget.couleur,
            filtres:     editTarget.filtres,
          }}
        />
      )}
    </>
  )
}
