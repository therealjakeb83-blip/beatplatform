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
        <svg viewBox="0 0 12 13" width="16" height="17" fill="white"><rect x="1" y="0.5" width="4" height="12" rx="1.5" /><rect x="7" y="0.5" width="4" height="12" rx="1.5" /></svg>
      ) : (
        <svg viewBox="0 0 12 13" width="17" height="18" fill="white"><path d="M10.4312 4.39786C11.7645 5.16766 11.7645 7.09216 10.4312 7.86197L3.64156 11.7819C2.30822 12.5517 0.641555 11.5895 0.641555 10.0499L0.641556 2.20994C0.641556 0.670336 2.30822 -0.291914 3.64156 0.477887L10.4312 4.39786Z" /></svg>
      )}
      <span>{isActive && isPlaying ? 'Pause' : 'Écouter le preview'}</span>
    </button>
  )
}
