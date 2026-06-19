'use client'

import { useState } from 'react'
import Link from 'next/link'

export type Liste = {
  id: string
  nom: string
  description: string | null
  dateLabel: string
  count: number
}

type Props = {
  listes: Liste[]
  creerListe: (fd: FormData) => Promise<void>
  modifierListe: (fd: FormData) => Promise<void>
  supprimerListe: (fd: FormData) => Promise<void>
}

type ModalProps = {
  listeId?: string
  initial?: { nom: string; description: string }
  onClose: () => void
  onSave: (fd: FormData) => Promise<void>
}

function ListeModal({ listeId, initial, onClose, onSave }: ModalProps) {
  const [nom, setNom] = useState(initial?.nom ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData()
    if (listeId) fd.set('id', listeId)
    fd.set('nom', nom)
    fd.set('description', description)
    await onSave(fd)
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-white mb-5">
          {listeId ? 'Modifier la liste' : 'Nouvelle liste'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex : Relance manuelle juin"
              required
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Description <span className="text-gray-600">(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex : Clients dormants à relancer personnellement"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !nom.trim()}
              className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : listeId ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ListesClient({ listes, creerListe, modifierListe, supprimerListe }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Liste | null>(null)

  async function handleCreate(fd: FormData) {
    await creerListe(fd)
    setShowCreate(false)
  }

  async function handleEdit(fd: FormData) {
    await modifierListe(fd)
    setEditTarget(null)
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">Listes</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Listes statiques — tu choisis manuellement qui est dedans
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            + Nouvelle liste
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {listes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <p className="text-gray-500 text-sm mb-1">Aucune liste créée</p>
              <p className="text-gray-700 text-xs mb-6">
                Crée ta première liste pour y ajouter des contacts manuellement
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
              >
                + Créer une liste
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {listes.map(liste => (
                <div
                  key={liste.id}
                  className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex flex-col gap-3 transition-colors group"
                >
                  {/* Top : nom + description + actions hover */}
                  <div className="flex items-start justify-between gap-4">
                    <Link href={`/dashboard/business/listes/${liste.id}`} className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm group-hover:text-indigo-300 transition-colors">
                        {liste.nom}
                      </p>
                      {liste.description && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {liste.description}
                        </p>
                      )}
                    </Link>

                    <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Modifier */}
                      <button
                        onClick={() => setEditTarget(liste)}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Modifier"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
                          <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9a.75.75 0 0 1 1.5 0v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                        </svg>
                      </button>

                      {/* Supprimer */}
                      <form action={supprimerListe}>
                        <input type="hidden" name="id" value={liste.id} />
                        <button
                          type="submit"
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
                          title="Supprimer"
                          onClick={e => {
                            if (!confirm(`Supprimer "${liste.nom}" ?`)) e.preventDefault()
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </form>

                      {/* Voir */}
                      <Link
                        href={`/dashboard/business/listes/${liste.id}`}
                        className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-indigo-400 transition-colors"
                        title="Voir les contacts"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M2 8c0 .414.336.75.75.75h8.69l-1.22 1.22a.75.75 0 1 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 1 0-1.06 1.06l1.22 1.22H2.75A.75.75 0 0 0 2 8Z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {liste.count} contact{liste.count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-700 text-xs">·</span>
                      <span className="text-xs text-gray-600">{liste.dateLabel}</span>
                    </div>
                    <Link
                      href={`/dashboard/business/listes/${liste.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                    >
                      Voir la liste →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <ListeModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {editTarget && (
        <ListeModal
          listeId={editTarget.id}
          initial={{ nom: editTarget.nom, description: editTarget.description ?? '' }}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
        />
      )}
    </>
  )
}
