'use client'

import { useState } from 'react'
import Link from 'next/link'

type Beat = {
  id: string
  titre: string
  bpm: number | null
  cle: string | null
  statut: string
  image_url: string | null
  created_at: string
  date_sortie: string | null
  styles: string[] | null
  type_beat: string[] | null
  mp3_tague_url: string | null
}

const STATUT_LABELS: Record<string, string> = {
  public: 'Public',
  prive: 'Réservé aux membres',
  masque: 'Masqué',
  programme: 'Programmé',
  vendu: 'Vendu',
}

const STATUT_COLORS: Record<string, string> = {
  public: 'bg-green-500/20 text-green-400',
  prive: 'bg-indigo-500/20 text-indigo-400',
  masque: 'bg-gray-500/20 text-gray-400',
  programme: 'bg-yellow-500/20 text-yellow-400',
  vendu: 'bg-red-500/20 text-red-400',
}

function CoverPlaceholder({ titre }: { titre: string }) {
  return (
    <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-bold flex-shrink-0">
      {titre.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function CatalogueBeatsList({ beats }: { beats: Beat[] }) {
  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('tous')

  const beatsFiltres = beats.filter(b => {
    const matchRecherche = b.titre.toLowerCase().includes(recherche.toLowerCase())
    const matchStatut = filtreStatut === 'tous' || b.statut === filtreStatut
    return matchRecherche && matchStatut
  })

  if (beats.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 text-lg mb-4">Aucun beat pour l&apos;instant.</p>
        <Link
          href="/dashboard/beats/nouveau"
          className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
        >
          Ajouter mon premier beat
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un beat..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
        />
        <select
          value={filtreStatut}
          onChange={e => setFiltreStatut(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
        >
          <option value="tous">Tous les statuts</option>
          <option value="public">Public</option>
          <option value="prive">Réservé aux membres</option>
          <option value="masque">Masqué</option>
          <option value="programme">Programmé</option>
          <option value="vendu">Vendu</option>
        </select>
      </div>

      {/* Compteur */}
      <p className="text-sm text-gray-500">
        {beatsFiltres.length} beat{beatsFiltres.length !== 1 ? 's' : ''}
        {filtreStatut !== 'tous' || recherche ? ` sur ${beats.length}` : ''}
      </p>

      {/* Liste */}
      {beatsFiltres.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Aucun beat ne correspond à ces filtres.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {beatsFiltres.map(beat => (
            <Link
              key={beat.id}
              href={`/dashboard/beats/${beat.id}/modifier`}
              className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl px-4 py-3 transition-colors group"
            >
              {beat.image_url
                ? <img src={beat.image_url} alt={beat.titre} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                : <CoverPlaceholder titre={beat.titre} />
              }

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white truncate">{beat.titre}</span>
                  {!beat.mp3_tague_url && (
                    <span className="text-xs text-yellow-500 flex-shrink-0">⚠ MP3 manquante</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {beat.bpm && <span>{beat.bpm} BPM</span>}
                  {beat.cle && <span>{beat.cle}</span>}
                  {beat.styles && beat.styles.length > 0 && (
                    <span>{beat.styles.slice(0, 2).join(', ')}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUT_COLORS[beat.statut]}`}>
                  {STATUT_LABELS[beat.statut]}
                </span>
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
