'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import BeatCard, { type BeatPublic } from './BeatCard'
import type { BeatMin } from './PlayerContext'
import { useDragScroll } from '../_lib/useDragScroll'

// Vitesse cible du carrousel « Réservés aux membres », en px/s — fixe quel
// que soit le nombre de beats (sinon la boucle infinie parcourt une piste
// plus longue dans le même temps fixe et accélère avec le catalogue).
const MEMBRES_MARQUEE_SPEED = 28

function toBeatMin(b: BeatPublic): BeatMin {
  return {
    id: b.id,
    titre: b.titre,
    image_url: b.image_url,
    mp3_tague_url: b.mp3_tague_url,
    bpm: b.bpm,
    tag: b.styles?.[0] ?? b.type_beat?.[0] ?? null,
    licences: b.licences,
  }
}

export default function BeatCatalogue({
  beats,
  beatsPrives = [],
  selection = [],
  slug,
  estAbonne = false,
}: {
  beats: BeatPublic[]
  beatsPrives?: BeatPublic[]
  selection?: BeatPublic[]
  slug: string
  estAbonne?: boolean
}) {
  const queue: BeatMin[] = beats.map(toBeatMin)
  const rowNouveautesRef = useDragScroll<HTMLDivElement>()
  const rowSelectionRef = useDragScroll<HTMLDivElement>()
  const marqueeRef = useRef<HTMLDivElement>(null)

  // Piste rendue deux fois (boucle -50%) — la moitié de sa largeur réelle
  // est la distance d'un tour. durée = distance / vitesse cible, recalculée
  // à chaque changement de taille (résolution différente desktop/mobile,
  // nombre de beats, chargement des covers).
  useEffect(() => {
    const track = marqueeRef.current
    if (!track) return
    const majDuree = () => {
      const distance = track.scrollWidth / 2
      track.style.setProperty('--marquee-duration', `${distance / MEMBRES_MARQUEE_SPEED}s`)
    }
    majDuree()
    const observer = new ResizeObserver(majDuree)
    observer.observe(track)
    return () => observer.disconnect()
  }, [beatsPrives.length])

  return (
    <div id="catalogue" className="shop-container">

      {/* Section beats membres */}
      {beatsPrives.length > 0 && (
        <section className="shop-members-box">
          <div className="shop-section-heading">
            <h2>
              Réservés aux membres <span className="shop-section-count">({beatsPrives.length})</span>
            </h2>
            <Link href={`/${slug}/membres`} className="shop-all-button">Tout voir<span className="shop-all-button-arrow"> ›</span></Link>
          </div>
          {/* Banderole défilante en boucle infinie — la liste est rendue deux
              fois à l'identique pour une boucle sans couture (translate -50%). */}
          <div className="members-marquee-wrap">
            <div className="members-marquee" ref={marqueeRef}>
              {beatsPrives.map(beat => (
                <BeatCard key={`m1-${beat.id}`} beat={beat} slug={slug} queue={[]} estAbonne={estAbonne} />
              ))}
              {beatsPrives.map(beat => (
                <BeatCard key={`m2-${beat.id}`} beat={beat} slug={slug} queue={[]} estAbonne={estAbonne} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section nouveautés */}
      {beats.length > 0 && (
        <section className="shop-section">
          <div className="shop-section-heading">
            <h2>Nouveautés</h2>
            <Link href={`/${slug}/beats`} className="shop-all-button">Tout voir<span className="shop-all-button-arrow"> ›</span></Link>
          </div>
          <div className="shop-row shop-row--beats" ref={rowNouveautesRef} data-hscroll>
            {beats.slice(0, 10).map(beat => (
              <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} />
            ))}
          </div>
        </section>
      )}

      {/* Section sélection du beatmaker */}
      {selection.length > 0 && (
        <section className="shop-section">
          <div className="shop-section-heading">
            <h2>La sélection du beatmaker</h2>
            <Link href={`/${slug}/selection`} className="shop-all-button">Tout voir<span className="shop-all-button-arrow"> ›</span></Link>
          </div>
          <div className="shop-row shop-row--beats" ref={rowSelectionRef} data-hscroll>
            {selection.slice(0, 10).map(beat => (
              <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
