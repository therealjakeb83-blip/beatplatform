'use client'

import { useState, useMemo } from 'react'
import BeatCard, { type BeatPublic } from './BeatCard'
import type { BeatMin } from './PlayerContext'

export default function BeatCatalogue({
  beats,
  slug,
}: {
  beats: BeatPublic[]
  slug: string
}) {
  const [recherche, setRecherche] = useState('')
  const [stylesActifs, setStylesActifs] = useState<string[]>([])
  const [typeBeatsActifs, setTypeBeatsActifs] = useState<string[]>([])

  // Listes uniques de styles et type_beat disponibles dans le catalogue
  const tousStyles = useMemo(() => {
    const set = new Set<string>()
    beats.forEach(b => b.styles?.forEach(s => set.add(s)))
    return [...set].sort()
  }, [beats])

  const tousTypeBeats = useMemo(() => {
    const set = new Set<string>()
    beats.forEach(b => b.type_beat?.forEach(t => set.add(t)))
    return [...set].sort()
  }, [beats])

  const beatsFiltres = useMemo(() => {
    return beats.filter(b => {
      if (recherche && !b.titre.toLowerCase().includes(recherche.toLowerCase())) return false
      if (stylesActifs.length > 0 && !stylesActifs.some(s => b.styles?.includes(s))) return false
      if (typeBeatsActifs.length > 0 && !typeBeatsActifs.some(t => b.type_beat?.includes(t))) return false
      return true
    })
  }, [beats, recherche, stylesActifs, typeBeatsActifs])

  const queue: BeatMin[] = beatsFiltres.map(b => ({
    id: b.id,
    titre: b.titre,
    image_url: b.image_url,
    mp3_tague_url: b.mp3_tague_url,
  }))

  function toggleStyle(style: string) {
    setStylesActifs(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    )
  }

  function toggleTypeBeat(type: string) {
    setTypeBeatsActifs(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const aFiltres = stylesActifs.length > 0 || typeBeatsActifs.length > 0 || recherche

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Barre de recherche */}
      <div className="mb-6">
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un beat..."
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Filtres style */}
      {tousStyles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tousStyles.map(style => (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                stylesActifs.includes(style)
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      )}

      {/* Filtres type beat */}
      {tousTypeBeats.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tousTypeBeats.map(type => (
            <button
              key={type}
              onClick={() => toggleTypeBeat(type)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeBeatsActifs.includes(type)
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {type} Type Beat
            </button>
          ))}
        </div>
      )}

      {/* Compteur */}
      <p className="text-sm text-gray-600 mb-6">
        {beatsFiltres.length} beat{beatsFiltres.length !== 1 ? 's' : ''}
        {aFiltres ? ` sur ${beats.length}` : ''}
      </p>

      {/* Grille */}
      {beatsFiltres.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500">Aucun beat ne correspond à ta recherche.</p>
          {aFiltres && (
            <button
              onClick={() => { setRecherche(''); setStylesActifs([]); setTypeBeatsActifs([]) }}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {beatsFiltres.map(beat => (
            <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} />
          ))}
        </div>
      )}
    </div>
  )
}
