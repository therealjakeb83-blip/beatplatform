'use client'

import { useState } from 'react'
import { usePlayer } from '../../_components/PlayerContext'
import FavoriButton from '../../_components/FavoriButton'
import LicenceSelectorModal from '../../_components/LicenceSelectorModal'
import type { BeatPublic } from '../../_components/BeatCard'
import type { BeatMin } from '../../_components/PlayerContext'

function PlayIcon() {
  return <svg viewBox="0 0 12 13" width="13" height="14" fill="currentColor"><path d="M10.4312 4.39786C11.7645 5.16766 11.7645 7.09216 10.4312 7.86197L3.64156 11.7819C2.30822 12.5517 0.641555 11.5895 0.641555 10.0499L0.641556 2.20994C0.641556 0.670336 2.30822 -0.291914 3.64156 0.477887L10.4312 4.39786Z" /></svg>
}
function PauseIcon() {
  return <svg viewBox="0 0 12 13" width="12" height="13" fill="currentColor"><rect x="1" y="0.5" width="4" height="12" rx="1.5" /><rect x="7" y="0.5" width="4" height="12" rx="1.5" /></svg>
}
function BpmIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h3l2-7 4 14 3-10 2 3h6" /></svg>
}
function ScaleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>
}
function DateIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
}

export default function ProduitCard({
  slug,
  beat,
  credits,
  moods,
  instruments,
  dateAffichee,
  clientId,
  estAbonne,
  remisePct,
  queue,
}: {
  slug: string
  beat: BeatPublic
  credits: string
  moods: string[]
  instruments: { nom: string; icone: string | null }[]
  dateAffichee: string
  clientId: string | null
  estAbonne: boolean
  remisePct: number
  queue: BeatMin[]
}) {
  const { currentBeat, isPlaying, play } = usePlayer()
  const [licenceOpen, setLicenceOpen] = useState(false)

  const enLecture = currentBeat?.id === beat.id && isPlaying
  const hasAudio = !!beat.mp3_tague_url

  function handlePlay() {
    if (!hasAudio) return
    play(beat, queue)
  }

  return (
    <section className="shop-product">
      <div className="shop-product-glow" aria-hidden="true">
        <div className="shop-hero-blob shop-hero-blob--a" />
        <div className="shop-hero-blob shop-hero-blob--b" />
      </div>

      <div className="shop-product-card">
        <div className="shop-product-cover-wrap">
          {beat.image_url ? (
            <img className="shop-product-cover" src={beat.image_url} alt={beat.titre} />
          ) : (
            <div className="shop-product-cover shop-beat-fallback">{beat.titre.slice(0, 2).toUpperCase()}</div>
          )}

          {enLecture && (
            <div className="shop-product-wave" aria-hidden="true">
              <svg className="shop-product-wave-a" viewBox="0 0 240 44" preserveAspectRatio="none">
                <path d="M0 20 Q15 5 30 20 T60 20 T90 20 T120 20 T150 20 T180 20 T210 20 T240 20 L240 44 L0 44 Z" />
              </svg>
              <svg className="shop-product-wave-b" viewBox="0 0 240 44" preserveAspectRatio="none">
                <path d="M0 27 Q20 12 40 27 T80 27 T120 27 T160 27 T200 27 T240 27 L240 44 L0 44 Z" />
              </svg>
            </div>
          )}

          <button
            onClick={handlePlay}
            className={`shop-product-play${!hasAudio ? ' shop-product-play--disabled' : ''}`}
            aria-label={enLecture ? 'Pause' : 'Écouter'}
          >
            {enLecture ? <PauseIcon /> : <PlayIcon />}
            {enLecture ? 'Pause' : 'Play'}
          </button>
        </div>

        <div className="shop-product-head">
          <div className="shop-product-head-info">
            <h1 className="shop-product-title">{beat.titre}</h1>
            <p className="shop-product-credits">{credits}</p>
          </div>
          <FavoriButton beatId={beat.id} clientId={clientId} slug={slug} className="shop-product-favori" />
        </div>

        {moods.length > 0 && (
          <div className="shop-product-tags">
            {moods.map(m => <span key={m} className="shop-product-tag">{m}</span>)}
          </div>
        )}

        {instruments.length > 0 && (
          <div className="shop-product-tags">
            {instruments.map(i => (
              <span key={i.nom} className="shop-product-tag shop-product-tag--instrument">
                {i.icone && <img className="shop-product-tag-icon" src={i.icone} alt="" aria-hidden="true" />}
                {i.nom}
              </span>
            ))}
          </div>
        )}

        <div className="shop-product-info">
          {beat.bpm && (
            <div className="shop-product-info-row"><BpmIcon /><span><strong>BPM :</strong> {beat.bpm}</span></div>
          )}
          {beat.cle && (
            <div className="shop-product-info-row"><ScaleIcon /><span><strong>Gamme :</strong> {beat.cle}</span></div>
          )}
          <div className="shop-product-info-row"><DateIcon /><span><strong>Date de publication :</strong> {dateAffichee}</span></div>
        </div>

        <button onClick={() => setLicenceOpen(true)} className="shop-product-cta">
          Choisir une licence
        </button>
      </div>

      <LicenceSelectorModal
        open={licenceOpen}
        onClose={() => setLicenceOpen(false)}
        beat={beat}
        slug={slug}
        estAbonne={estAbonne}
        remisePct={remisePct}
      />
    </section>
  )
}
