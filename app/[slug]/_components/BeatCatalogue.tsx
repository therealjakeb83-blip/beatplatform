'use client'

import Link from 'next/link'
import BeatCard, { type BeatPublic } from './BeatCard'
import type { BeatMin } from './PlayerContext'
import { useDragScroll } from '../_lib/useDragScroll'

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
            <div className="members-marquee">
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
