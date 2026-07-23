'use client'

import { useState } from 'react'
import { usePlayer } from './PlayerContext'
import { useCart } from './CartContext'
import FavoriButton from './FavoriButton'

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
function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="4" y="5" width="2.6" height="14" rx="1" />
      <path d="M19 5.7v12.6a1 1 0 01-1.55.84L8.9 13.35a1.6 1.6 0 010-2.7l8.55-5.79A1 1 0 0119 5.7z" />
    </svg>
  )
}
function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="17.4" y="5" width="2.6" height="14" rx="1" />
      <path d="M5 5.7v12.6a1 1 0 001.55.84l8.55-5.79a1.6 1.6 0 000-2.7L6.55 4.86A1 1 0 005 5.7z" />
    </svg>
  )
}
function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h3.2c1.4 0 2.7.75 3.4 1.95L14.4 17c.7 1.2 2 1.95 3.4 1.95H21" />
      <path d="M17.5 3.3L21 6l-3.5 2.7" />
      <path d="M3 18h3.2c1.4 0 2.7-.75 3.4-1.95" />
      <path d="M13.9 8.05c.7-1.2 2-1.95 3.4-1.95H21" />
      <path d="M17.5 14.9l3.5 2.7-3.5 2.7" />
    </svg>
  )
}
function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
      <text x="12" y="15.3" fontSize="8.5" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">1</text>
    </svg>
  )
}

export default function PlayerBar({
  slug,
  clientId,
}: {
  slug: string
  clientId: string | null
}) {
  const {
    currentBeat, isPlaying, progress, duration, isShuffled, loopOne,
    togglePlay, next, prev, seek, toggleShuffle, toggleLoop,
  } = usePlayer()
  const { addItem, open } = useCart()
  const [expanded, setExpanded] = useState(false)

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

          <FavoriButton beatId={currentBeat.id} clientId={clientId} slug={slug} className="shop-player-favori" />

          {moinsChere && <span className="shop-player-price">dès {moinsChere.prix}€</span>}
          {moinsChere && <button onClick={ajouterAuPanier} className="shop-player-add">+ Ajouter</button>}
        </div>
      </div>

      {/* Mini-player mobile — tap n'importe où sur la barre pour déplier */}
      {!expanded && (
        <div className="shop-player-mobile" onClick={() => setExpanded(true)}>
          {currentBeat.image_url ? (
            <img className="shop-player-mobile-cover" src={currentBeat.image_url} alt={currentBeat.titre} />
          ) : (
            <div className="shop-player-mobile-cover shop-beat-fallback" style={{ position: 'relative' }}>{currentBeat.titre.slice(0, 2).toUpperCase()}</div>
          )}

          <div className="shop-player-mobile-info">
            <p className="shop-player-title">{currentBeat.titre}</p>
            {meta && <p className="shop-player-tag">{meta}</p>}
          </div>

          <button
            onClick={e => { e.stopPropagation(); togglePlay() }}
            className="shop-player-mobile-toggle"
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          {moinsChere && (
            <button onClick={e => { e.stopPropagation(); ajouterAuPanier() }} className="shop-player-mobile-add">{moinsChere.prix}€ +</button>
          )}
        </div>
      )}

      {/* Panneau déplié mobile */}
      {expanded && (
        <div className="shop-player-expanded">
          <div className="shop-player-expanded-inner">
            <button
              onClick={() => setExpanded(false)}
              className="shop-player-expanded-handle"
              aria-label="Réduire le player"
            />

            <div className="shop-player-expanded-cover-wrap">
              {currentBeat.image_url ? (
                <img className="shop-player-expanded-cover" src={currentBeat.image_url} alt={currentBeat.titre} />
              ) : (
                <div className="shop-player-expanded-cover shop-beat-fallback" style={{ position: 'relative' }}>{currentBeat.titre.slice(0, 2).toUpperCase()}</div>
              )}
            </div>

            <div className="shop-player-expanded-head">
              <div className="shop-player-expanded-head-info">
                <p className="shop-player-title">{currentBeat.titre}</p>
                {meta && <p className="shop-player-tag">{meta}</p>}
              </div>
              <FavoriButton beatId={currentBeat.id} clientId={clientId} slug={slug} className="shop-player-expanded-favori" />
            </div>

            <div className="shop-player-expanded-progress">
              <span className="shop-player-time">{formatTime(elapsed)}</span>
              <div className="shop-player-track" onClick={handleProgressClick}>
                <div className="shop-player-track-bg" />
                <div className="shop-player-track-fill" style={{ width: `${progress * 100}%` }} />
                <div className="shop-player-track-thumb" style={{ left: `${progress * 100}%` }} />
              </div>
              <span className="shop-player-time">{formatTime(duration)}</span>
            </div>

            <div className="shop-player-expanded-controls">
              <div className="shop-player-expanded-sideleft">
                <button
                  onClick={toggleShuffle}
                  className={`shop-player-expanded-toggle-btn${isShuffled ? ' is-active' : ''}`}
                  aria-label="Lecture aléatoire"
                  aria-pressed={isShuffled}
                  title="Lecture aléatoire"
                >
                  <ShuffleIcon />
                </button>
                <button
                  onClick={toggleLoop}
                  className={`shop-player-expanded-toggle-btn${loopOne ? ' is-active' : ''}`}
                  aria-label="Répéter le morceau"
                  aria-pressed={loopOne}
                  title="Répéter le morceau"
                >
                  <LoopIcon />
                </button>
              </div>

              <button onClick={prev} className="shop-player-expanded-skip" aria-label="Beat précédent">
                <PrevIcon />
              </button>
              <button onClick={togglePlay} className="shop-player-expanded-toggle" aria-label={isPlaying ? 'Pause' : 'Lecture'}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button onClick={next} className="shop-player-expanded-skip" aria-label="Beat suivant">
                <NextIcon />
              </button>

              {moinsChere && (
                <button onClick={ajouterAuPanier} className="shop-player-expanded-price">{moinsChere.prix} € +</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
