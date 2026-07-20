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

  const genre = beat.styles?.[0] ?? beat.type_beat?.[0] ?? null

  return (
    <Link
      href={estVerrouille ? `/${slug}/membres` : `/${slug}/${beat.id}`}
      className="group shop-beat-card"
    >
      {/* Cover + bouton play */}
      <div className="shop-beat-image">
        {beat.image_url ? (
          <img src={beat.image_url} alt={beat.titre} />
        ) : (
          <div className="shop-beat-fallback">{beat.titre.slice(0, 2).toUpperCase()}</div>
        )}

        {genre && <span className="shop-beat-genre">{genre}</span>}

        {/* Bouton favori */}
        {!estVerrouille && (
          <FavoriButton beatId={beat.id} clientId={clientId} slug={slug} />
        )}

        {estVerrouille ? (
          <div className="shop-beat-locked">🔒</div>
        ) : (
          <button
            onClick={handlePlay}
            className="shop-play"
            style={!hasAudio ? { opacity: .5, cursor: 'not-allowed' } : undefined}
            aria-label={isActive && isPlaying ? 'Pause' : 'Écouter'}
          >
            {isActive && isPlaying ? '⏸' : '▶'}
          </button>
        )}

        {/* Badge Free DL */}
        {showFreeDL && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setModalOpen(true) }}
            className="absolute bottom-2 right-2 z-10 flex items-center gap-1 bg-green-600/90 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full transition-colors"
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
      <h3>{beat.titre}</h3>

      {estVerrouille && (
        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--shop-primary)' }}>Réservé aux membres</p>
      )}
    </Link>
  )
}
