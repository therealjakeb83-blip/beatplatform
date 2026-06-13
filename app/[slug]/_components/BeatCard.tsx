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

  const licencesTriees = [...beat.licences].sort((a, b) => a.prix - b.prix)

  return (
    <Link
      href={estVerrouille ? `/${slug}/membres` : `/${slug}/${beat.id}`}
      className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-2xl overflow-hidden transition-all block"
    >
      {/* Cover + bouton play */}
      <div className="relative aspect-square">
        {beat.image_url ? (
          <img
            src={beat.image_url}
            alt={beat.titre}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 text-3xl font-black">
            {beat.titre.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Bouton favori */}
        {!estVerrouille && (
          <FavoriButton beatId={beat.id} clientId={clientId} slug={slug} />
        )}

        {/* Overlay play ou cadenas */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="absolute inset-0 bg-black/40" />
          {estVerrouille ? (
            <div className="relative z-10 w-14 h-14 rounded-full bg-black/60 flex items-center justify-center text-2xl">
              🔒
            </div>
          ) : (
            <button
              onClick={handlePlay}
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-xl transition-transform hover:scale-110 ${
                hasAudio
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : 'bg-gray-700 cursor-not-allowed'
              }`}
              aria-label={isActive && isPlaying ? 'Pause' : 'Écouter'}
            >
              {isActive && isPlaying ? '⏸' : '▶'}
            </button>
          )}
        </div>

        {/* Badge "En lecture" */}
        {isActive && isPlaying && (
          <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
            ▶ En lecture
          </div>
        )}

        {/* Badge Free DL */}
        {showFreeDL && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setModalOpen(true) }}
            className="absolute bottom-2 left-2 flex items-center gap-1 bg-green-600/90 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full transition-colors"
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
      <div className="p-4">
        <h3 className="font-bold text-white truncate text-sm">{beat.titre}</h3>

        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {beat.bpm && <span>{beat.bpm} BPM</span>}
          {beat.bpm && beat.cle && <span>·</span>}
          {beat.cle && <span>{beat.cle}</span>}
        </div>

        {/* Tags */}
        {(beat.styles?.length || beat.type_beat?.length) ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {beat.type_beat?.slice(0, 2).map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300">
                {t}
              </span>
            ))}
            {beat.styles?.slice(0, 1).map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                {s}
              </span>
            ))}
          </div>
        ) : null}

        {/* Prix licences */}
        {estVerrouille ? (
          <p className="text-xs text-indigo-400 mt-3 font-medium">Réservé aux membres</p>
        ) : licencesTriees.length > 0 ? (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {licencesTriees.map(l => (
              <span key={l.id} className="text-xs font-semibold text-white">
                {l.sur_demande ? `${l.nom} →` : `${l.prix}€`}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 mt-3">Aucune licence active</p>
        )}
      </div>
    </Link>
  )
}
