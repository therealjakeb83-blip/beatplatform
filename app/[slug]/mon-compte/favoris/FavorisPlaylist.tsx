'use client'

import Link from 'next/link'
import { usePlayer, type BeatMin } from '../../_components/PlayerContext'

type FavorisBeat = BeatMin & {
  bpm: number | null
  cle: string | null
}

export default function FavorisPlaylist({
  beats,
  slug,
}: {
  beats: FavorisBeat[]
  slug: string
}) {
  const { play, currentBeat, isPlaying } = usePlayer()

  const queue: BeatMin[] = beats.map(b => ({
    id: b.id,
    titre: b.titre,
    image_url: b.image_url,
    mp3_tague_url: b.mp3_tague_url,
  }))

  return (
    <div className="space-y-2">
      {beats.map(beat => {
        const isActive = currentBeat?.id === beat.id
        const hasAudio = !!beat.mp3_tague_url

        return (
          <div
            key={beat.id}
            className={`flex items-center gap-3 rounded-xl p-3 border transition-colors ${
              isActive
                ? 'bg-brand-950/40 border-brand-500/30'
                : 'bg-gray-900 border-gray-800 hover:border-gray-700'
            }`}
          >
            {/* Bouton play */}
            <button
              onClick={() => hasAudio && play(beat, queue)}
              disabled={!hasAudio}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors text-sm ${
                hasAudio
                  ? isActive
                    ? 'bg-brand-600 hover:bg-brand-500 text-white'
                    : 'bg-gray-800 hover:bg-brand-600 text-gray-400 hover:text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              aria-label={isActive && isPlaying ? 'Pause' : 'Écouter'}
            >
              {isActive && isPlaying ? (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7l-10.5-6.5A1 1 0 0 0 7 5.5Z" /></svg>
              )}
            </button>

            {/* Miniature */}
            {beat.image_url ? (
              <img src={beat.image_url} alt={beat.titre} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-xs font-bold">
                {beat.titre.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Titre + infos */}
            <Link href={`/${slug}/${beat.id}`} className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isActive ? 'text-brand-300' : 'text-white'}`}>
                {beat.titre}
              </p>
              {(beat.bpm || beat.cle) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {[beat.bpm && `${beat.bpm} BPM`, beat.cle].filter(Boolean).join(' · ')}
                </p>
              )}
            </Link>

            <span className="text-red-400 flex-shrink-0">♥</span>
          </div>
        )
      })}
    </div>
  )
}
