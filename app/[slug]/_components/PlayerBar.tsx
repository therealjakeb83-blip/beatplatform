'use client'

import { usePlayer } from './PlayerContext'

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PlayerBar() {
  const { currentBeat, isPlaying, progress, duration, togglePlay, next, prev, seek } = usePlayer()

  if (!currentBeat) return null

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seek(Math.max(0, Math.min(1, pct)))
  }

  const elapsed = progress * duration

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 z-50">
      {/* Barre de progression cliquable */}
      <div
        className="h-1 bg-gray-700 cursor-pointer group"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-brand-500 group-hover:bg-brand-400 transition-colors relative"
          style={{ width: `${progress * 100}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto flex items-center gap-4 px-4 py-3">
        {/* Cover */}
        <div className="w-10 h-10 rounded bg-gray-800 flex-shrink-0 overflow-hidden">
          {currentBeat.image_url ? (
            <img src={currentBeat.image_url} alt={currentBeat.titre} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">
              {currentBeat.titre.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Titre + temps */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{currentBeat.titre}</p>
          <p className="text-gray-500 text-xs tabular-nums">
            {formatTime(elapsed)} / {formatTime(duration)}
          </p>
        </div>

        {/* Contrôles */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={prev}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-lg"
            aria-label="Beat précédent"
          >
            ⏮
          </button>

          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center transition-colors text-lg"
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7l-10.5-6.5A1 1 0 0 0 7 5.5Z" /></svg>
            )}
          </button>

          <button
            onClick={next}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-lg"
            aria-label="Beat suivant"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  )
}
