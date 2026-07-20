'use client'

import { useState, useMemo } from 'react'
import BeatCard, { type BeatPublic } from '../../_components/BeatCard'
import type { BeatMin } from '../../_components/PlayerContext'

export default function CatalogueClient({
  beats,
  slug,
  estAbonne = false,
  clientId = null,
}: {
  beats: BeatPublic[]
  slug: string
  estAbonne?: boolean
  clientId?: string | null
}) {
  const [recherche, setRecherche] = useState('')
  const [stylesActifs, setStylesActifs] = useState<string[]>([])
  const [typeBeatsActifs, setTypeBeatsActifs] = useState<string[]>([])

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

  const queue: BeatMin[] = beats.map(b => ({
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

  const aFiltres = stylesActifs.length > 0 || typeBeatsActifs.length > 0 || !!recherche

  return (
    <div>
      {/* Barre de recherche */}
      <div className="mb-4">
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un beat..."
          className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
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
                  ? 'bg-brand-600 border-brand-600 text-white'
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
        <div className="flex flex-wrap gap-2 mb-5">
          {tousTypeBeats.map(type => (
            <button
              key={type}
              onClick={() => toggleTypeBeat(type)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeBeatsActifs.includes(type)
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {type} Type Beat
            </button>
          ))}
        </div>
      )}

      {/* Compteur */}
      <p className="text-sm text-gray-600 mb-5">
        {beatsFiltres.length} beat{beatsFiltres.length !== 1 ? 's' : ''}
        {aFiltres ? ` sur ${beats.length}` : ''}
      </p>

      {beatsFiltres.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500">Aucun beat ne correspond à ta recherche.</p>
          {aFiltres && (
            <button
              onClick={() => { setRecherche(''); setStylesActifs([]); setTypeBeatsActifs([]) }}
              className="mt-4 text-brand-400 hover:text-brand-300 text-sm transition-colors"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {beatsFiltres.map(beat => (
            <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} clientId={clientId} />
          ))}
        </div>
      )}
    </div>
  )
}
