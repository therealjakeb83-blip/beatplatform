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
      <span className="text-xl">{isActive && isPlaying ? '⏸' : '▶'}</span>
      <span>{isActive && isPlaying ? 'Pause' : 'Écouter le preview'}</span>
    </button>
  )
}
