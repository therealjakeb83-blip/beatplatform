'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePlayer, type BeatMin } from './PlayerContext'
import FavoriButton from './FavoriButton'
import FreeDLModal from './FreeDLModal'

export type LicencePublic = {
  id: string
  nom: string
  modele: string
  prix: number
  sur_demande: boolean
}

export type BeatPublic = BeatMin & {
  bpm: number | null
  cle: string | null
  styles: string[] | null
  type_beat: string[] | null
  ambiances: string[] | null
  instruments: string[] | null
  licences: LicencePublic[]
  prive?: boolean
  free_download_actif?: boolean
}

export default function BeatCard({
  beat,
  slug,
  queue,
  estAbonne = false,
  clientId = null,
}: {
  beat: BeatPublic
  slug: string
  queue: BeatMin[]
  estAbonne?: boolean
  clientId?: string | null
}) {
  const { play, currentBeat, isPlaying } = usePlayer()
  const [modalOpen, setModalOpen] = useState(false)

  const isActive = currentBeat?.id === beat.id
  const hasAudio = !!beat.mp3_tague_url
  const estVerrouille = beat.prive && !estAbonne
  const showFreeDL = beat.free_download_actif && beat.mp3_tague_url && !estVerrouille

  function handlePlay(e: React.MouseEvent) {
    e.preventDefault()
    if (!hasAudio || estVerrouille) return
    play(beat, queue)
  }

  const tag = beat.styles?.[0] ?? beat.type_beat?.[0] ?? null
  const prixMin = beat.licences.length > 0 ? Math.min(...beat.licences.map(l => l.prix)) : null

  return (
    <Link
      href={estVerrouille ? `/${slug}/membres` : `/${slug}/${beat.id}`}
      className="group shop-beat-card"
    >
      {/* Cover + bouton play */}
      <div className="shop-beat-cover">
        {beat.image_url ? (
          <img src={beat.image_url} alt={beat.titre} />
        ) : (
          <div className="shop-beat-fallback">{beat.titre.slice(0, 2).toUpperCase()}</div>
        )}

        {tag && <span className="shop-beat-tag">{tag}</span>}

        {/* Bouton favori */}
        {!estVerrouille && (
          <FavoriButton beatId={beat.id} clientId={clientId} slug={slug} />
        )}

        {estVerrouille ? (
          <div className="shop-beat-locked">
            <div className="shop-beat-locked-icon">🔒</div>
          </div>
        ) : (
          <button
            onClick={handlePlay}
            className="shop-beat-play"
            style={!hasAudio ? { opacity: .5, cursor: 'not-allowed' } : undefined}
            aria-label={isActive && isPlaying ? 'Pause' : 'Écouter'}
          >
            {isActive && isPlaying ? (
              <svg viewBox="0 0 12 13" width="11" height="12" fill="currentColor"><rect x="1" y="0.5" width="4" height="12" rx="1.5" /><rect x="7" y="0.5" width="4" height="12" rx="1.5" /></svg>
            ) : (
              <svg viewBox="0 0 12 13" width="12" height="13" fill="currentColor"><path d="M10.4312 4.39786C11.7645 5.16766 11.7645 7.09216 10.4312 7.86197L3.64156 11.7819C2.30822 12.5517 0.641555 11.5895 0.641555 10.0499L0.641556 2.20994C0.641556 0.670336 2.30822 -0.291914 3.64156 0.477887L10.4312 4.39786Z" /></svg>
            )}
          </button>
        )}

        {/* Badge Free DL */}
        {showFreeDL && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setModalOpen(true) }}
            className="shop-freedl-btn"
          >
            ↓ Free
          </button>
        )}
      </div>

      {showFreeDL && (
        <FreeDLModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          beatId={beat.id}
          beatTitre={beat.titre}
          slug={slug}
          clientId={clientId}
        />
      )}

      {/* Infos */}
      <h3 className={`shop-beat-title${estVerrouille ? ' is-dimmed' : ''}`}>{beat.titre}</h3>

      {estVerrouille ? (
        <p className="shop-beat-locked-caption">Réservé aux membres 👑</p>
      ) : (
        <div className="shop-beat-meta">
          <span>{beat.bpm ? `${beat.bpm} BPM` : ''}</span>
          {prixMin !== null && <span className="shop-beat-price">dès {prixMin}€</span>}
        </div>
      )}
    </Link>
  )
}
