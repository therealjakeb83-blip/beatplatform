'use client'

import { useState } from 'react'
import Link from 'next/link'
import { couleurCls, type SegmentDB } from '../../_lib/segments'
import SegmentModal from './SegmentModal'

type Props = {
  segments: (SegmentDB & { count: number })[]
  creerSegment:    (fd: FormData) => Promise<void>
  supprimerSegment: (fd: FormData) => Promise<void>
}

export default function SegmentsClient({ segments, creerSegment, supprimerSegment }: Props) {
  const [showCreate, setShowCreate] = useState(false)

  async function handleSave(fd: FormData) {
    await creerSegment(fd)
    setShowCreate(false)
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
                  className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex items-start justify-between gap-4 transition-colors group"
                >
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/dashboard/business/segments/${seg.id}`}
                      className="text-gray-700 group-hover:text-indigo-400 transition-colors text-lg mt-1"
                    >
                      →
                    </Link>
                    <form action={supprimerSegment}>
                      <input type="hidden" name="id" value={seg.id} />
                      <button
                        type="submit"
                        className="text-gray-700 hover:text-red-400 transition-colors text-sm leading-none opacity-0 group-hover:opacity-100"
                        title="Supprimer"
                        onClick={e => {
                          if (!confirm(`Supprimer "${seg.nom}" ?`)) e.preventDefault()
                        }}
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <SegmentModal
          onClose={() => setShowCreate(false)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
