'use client'

import { usePlayer, type BeatMin } from './PlayerContext'

export default function BeatDetailPlayButton({ beat }: { beat: BeatMin }) {
  const { play, currentBeat, isPlaying } = usePlayer()

  const isActive = currentBeat?.id === beat.id
  const hasAudio = !!beat.mp3_tague_url

  function handleClick() {
    if (!hasAudio) return
    play(beat, [beat])
  }

  if (!hasAudio) {
    return (
      <div className="flex items-center gap-3 text-gray-600 text-sm">
        <span>Aucun fichier preview disponible</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-3 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]"
    >
      {isActive && isPlaying ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.5-6.5a1 1 0 0 0 0-1.7l-10.5-6.5A1 1 0 0 0 7 5.5Z" /></svg>
      )}
      <span>{isActive && isPlaying ? 'Pause' : 'Écouter le preview'}</span>
    </button>
  )
}
