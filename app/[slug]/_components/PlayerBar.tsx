'use client'

import { usePlayer } from './PlayerContext'
import { useCart } from './CartContext'

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function PlayIcon() {
  return <svg viewBox="0 0 12 13" width="12" height="13" fill="currentColor"><path d="M10.4312 4.39786C11.7645 5.16766 11.7645 7.09216 10.4312 7.86197L3.64156 11.7819C2.30822 12.5517 0.641555 11.5895 0.641555 10.0499L0.641556 2.20994C0.641556 0.670336 2.30822 -0.291914 3.64156 0.477887L10.4312 4.39786Z" /></svg>
}
function PauseIcon() {
  return <svg viewBox="0 0 12 13" width="11" height="12" fill="currentColor"><rect x="1" y="0.5" width="4" height="12" rx="1.5" /><rect x="7" y="0.5" width="4" height="12" rx="1.5" /></svg>
}

export default function PlayerBar() {
  const { currentBeat, isPlaying, progress, duration, togglePlay, next, prev, seek } = usePlayer()
  const { addItem, open } = useCart()

  if (!currentBeat) return null

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    seek(Math.max(0, Math.min(1, pct)))
  }

  const elapsed = progress * duration
  const meta = [currentBeat.tag, currentBeat.bpm ? `${currentBeat.bpm} BPM` : null].filter(Boolean).join(' · ')

  const licencesActives = (currentBeat.licences ?? []).filter(l => !l.sur_demande)
  const moinsChere = licencesActives.length > 0
    ? licencesActives.reduce((min, l) => (l.prix < min.prix ? l : min))
    : null

  function ajouterAuPanier() {
    if (!moinsChere || !currentBeat) return
    addItem({
      beatId: currentBeat.id,
      licenceId: moinsChere.id,
      titre: currentBeat.titre,
      imageUrl: currentBeat.image_url,
      licenceNom: moinsChere.nom,
      prix: moinsChere.prix,
    })
    open()
  }

  return (
    <>
      {/* Desktop */}
      <div className="shop-player">
        <div className="shop-player-inner">
          {currentBeat.image_url ? (
            <img className="shop-player-cover" src={currentBeat.image_url} alt={currentBeat.titre} />
          ) : (
            <div className="shop-player-cover shop-beat-fallback" style={{ position: 'relative' }}>{currentBeat.titre.slice(0, 2).toUpperCase()}</div>
          )}

          <div className="shop-player-info">
            <p className="shop-player-title">{currentBeat.titre}</p>
            {meta && <p className="shop-player-tag">{meta}</p>}
          </div>

          <button onClick={prev} className="shop-player-skip" aria-label="Beat précédent">⏮</button>

          <button onClick={togglePlay} className="shop-player-toggle" aria-label={isPlaying ? 'Pause' : 'Lecture'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button onClick={next} className="shop-player-skip" aria-label="Beat suivant">⏭</button>

          <span className="shop-player-time">{formatTime(elapsed)}</span>
          <div className="shop-player-track" onClick={handleProgressClick}>
            <div className="shop-player-track-bg" />
            <div className="shop-player-track-fill" style={{ width: `${progress * 100}%` }} />
            <div className="shop-player-track-thumb" style={{ left: `${progress * 100}%` }} />
          </div>
          <span className="shop-player-time">{formatTime(duration)}</span>

          {moinsChere && <span className="shop-player-price">dès {moinsChere.prix}€</span>}
          {moinsChere && <button onClick={ajouterAuPanier} className="shop-player-add">+ Ajouter</button>}
        </div>
      </div>

      {/* Mini-player mobile */}
      <div className="shop-player-mobile">
        {currentBeat.image_url ? (
          <img className="shop-player-mobile-cover" src={currentBeat.image_url} alt={currentBeat.titre} />
        ) : (
          <div className="shop-player-mobile-cover shop-beat-fallback" style={{ position: 'relative' }}>{currentBeat.titre.slice(0, 2).toUpperCase()}</div>
        )}

        <div className="shop-player-mobile-info">
          <p className="shop-player-title">{currentBeat.titre}</p>
          {meta && <p className="shop-player-tag">{meta}</p>}
        </div>

        <button onClick={togglePlay} className="shop-player-mobile-toggle" aria-label={isPlaying ? 'Pause' : 'Lecture'}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {moinsChere && (
          <button onClick={ajouterAuPanier} className="shop-player-mobile-add">{moinsChere.prix}€ +</button>
        )}
      </div>
    </>
  )
}
