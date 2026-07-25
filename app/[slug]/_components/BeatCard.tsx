'use client'

import Link from 'next/link'
import { usePlayer, type BeatMin } from './PlayerContext'
import { useCart } from './CartContext'

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
}: {
  beat: BeatPublic
  slug: string
  queue: BeatMin[]
  estAbonne?: boolean
}) {
  const { play, currentBeat, isPlaying, mobileControlsBeatId, setMobileControlsBeatId } = usePlayer()
  const { addItem, open } = useCart()

  const isActive = currentBeat?.id === beat.id
  const enLecture = isActive && isPlaying
  const hasAudio = !!beat.mp3_tague_url
  const estVerrouille = beat.prive && !estAbonne
  const controlesMobileOuverts = isActive && mobileControlsBeatId === beat.id

  function handlePlay(e: React.MouseEvent) {
    e.preventDefault()
    if (!hasAudio || estVerrouille) return
    play(beat, queue)
  }

  // Tap sur la cover (mobile uniquement — desktop laisse la navigation
  // normale du Link, le hover révèle déjà le bouton play). Premier tap :
  // ouvre les contrôles et lance le beat s'il n'est pas déjà en lecture.
  // Re-tap : referme les contrôles sans couper la lecture.
  function handleCoverTap(e: React.MouseEvent) {
    if (estVerrouille || window.matchMedia('(hover: hover)').matches) return
    e.preventDefault()
    if (controlesMobileOuverts) {
      setMobileControlsBeatId(null)
      return
    }
    setMobileControlsBeatId(beat.id)
    if (hasAudio && !enLecture) play(beat, queue)
  }

  function handleMobilePlayBtn(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!hasAudio) return
    play(beat, queue)
  }

  function handleMobileCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!moinsChere) return
    addItem({
      beatId: beat.id,
      licenceId: moinsChere.id,
      titre: beat.titre,
      imageUrl: beat.image_url,
      licenceNom: moinsChere.nom,
      prix: moinsChere.prix,
    })
    open()
  }

  const tag = beat.styles?.[0] ?? beat.type_beat?.[0] ?? null
  const prixMin = beat.licences.length > 0 ? Math.min(...beat.licences.map(l => l.prix)) : null
  const licencesActives = beat.licences.filter(l => !l.sur_demande)
  const moinsChere = licencesActives.length > 0
    ? licencesActives.reduce((min, l) => (l.prix < min.prix ? l : min))
    : null

  return (
    <Link
      href={estVerrouille ? `/${slug}/membres` : `/${slug}/${beat.id}`}
      className="group shop-beat-card"
    >
      {/* Cover + bouton play */}
      <div
        className={`shop-beat-cover${estVerrouille ? ' shop-beat-cover--locked' : ''}${enLecture ? ' is-playing' : ''}${controlesMobileOuverts ? ' mobile-controls-open' : ''}`}
        onClick={handleCoverTap}
      >
        {beat.image_url ? (
          <img src={beat.image_url} alt={beat.titre} draggable={false} />
        ) : (
          <div className="shop-beat-fallback">{beat.titre.slice(0, 2).toUpperCase()}</div>
        )}

        {tag && <span className="shop-beat-tag">{tag}</span>}

        {estVerrouille ? (
          <div className="shop-beat-locked">
            <div className="shop-beat-locked-icon">🔒</div>
          </div>
        ) : (
          <>
            {/* Desktop : invisible par défaut, apparaît au survol de la cover */}
            <button
              onClick={handlePlay}
              className={`shop-beat-play${!hasAudio ? ' shop-beat-play--disabled' : ''}`}
              aria-label={enLecture ? 'Pause' : 'Écouter'}
            >
              {enLecture ? (
                <svg viewBox="0 0 12 13" width="11" height="12" fill="currentColor"><rect x="1" y="0.5" width="4" height="12" rx="1.5" /><rect x="7" y="0.5" width="4" height="12" rx="1.5" /></svg>
              ) : (
                <svg viewBox="0 0 12 13" width="12" height="13" fill="currentColor"><path d="M10.4312 4.39786C11.7645 5.16766 11.7645 7.09216 10.4312 7.86197L3.64156 11.7819C2.30822 12.5517 0.641555 11.5895 0.641555 10.0499L0.641556 2.20994C0.641556 0.670336 2.30822 -0.291914 3.64156 0.477887L10.4312 4.39786Z" /></svg>
              )}
            </button>

            {/* Mobile : aucun bouton visible par défaut, tap sur la cover */}
            <div className="shop-beat-mobile-veil" />
            <div className="shop-beat-mobile-ctrls">
              <button onClick={handleMobilePlayBtn} className="shop-beat-mobile-play" aria-label={enLecture ? 'Pause' : 'Écouter'}>
                {enLecture ? (
                  <svg viewBox="0 0 12 13" width="12" height="13" fill="currentColor"><rect x="1" y="0.5" width="4" height="12" rx="1.5" /><rect x="7" y="0.5" width="4" height="12" rx="1.5" /></svg>
                ) : (
                  <svg viewBox="0 0 12 13" width="13" height="14" fill="currentColor"><path d="M10.4312 4.39786C11.7645 5.16766 11.7645 7.09216 10.4312 7.86197L3.64156 11.7819C2.30822 12.5517 0.641555 11.5895 0.641555 10.0499L0.641556 2.20994C0.641556 0.670336 2.30822 -0.291914 3.64156 0.477887L10.4312 4.39786Z" /></svg>
                )}
              </button>
              {moinsChere && (
                <>
                  <span className="shop-beat-mobile-sep" />
                  <button onClick={handleMobileCart} className="shop-beat-mobile-cart" aria-label="Acheter">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 7h12l-1 13H7L6 7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 7a3 3 0 016 0" stroke="currentColor" strokeWidth="2" /></svg>
                  </button>
                </>
              )}
            </div>
          </>
        )}

      </div>

      {/* Infos */}
      <h3 className={`shop-beat-title${estVerrouille ? ' is-dimmed' : ''}`}>{beat.titre}</h3>

      {estVerrouille ? (
        <p className="shop-beat-locked-caption">Réservé aux membres 👑</p>
      ) : (
        <div className="shop-beat-meta">
          <span>{beat.bpm ? `${beat.bpm} BPM` : ''}</span>
          {prixMin !== null && (
            <span className="shop-beat-price">
              <span className="shop-beat-price-prefix">dès </span>{prixMin}€
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
