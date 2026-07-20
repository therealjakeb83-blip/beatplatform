'use client'

import Link from 'next/link'
import BeatCard, { type BeatPublic } from './BeatCard'
import type { BeatMin } from './PlayerContext'

export default function BeatCatalogue({
  beats,
  beatsPrives = [],
  selection = [],
  slug,
  estAbonne = false,
  clientId = null,
}: {
  beats: BeatPublic[]
  beatsPrives?: BeatPublic[]
  selection?: BeatPublic[]
  slug: string
  estAbonne?: boolean
  clientId?: string | null
}) {
  const queue: BeatMin[] = beats.map(b => ({
    id: b.id,
    titre: b.titre,
    image_url: b.image_url,
    mp3_tague_url: b.mp3_tague_url,
  }))

  return (
    <div id="catalogue" className="shop-container shop-catalogue">

      {/* Section beats membres */}
      {beatsPrives.length > 0 && (
        <section className="shop-members-box">
          <div className="shop-section-heading">
            <h2>
              Réservés aux membres <span className="shop-section-count">({beatsPrives.length})</span>
            </h2>
            <Link href={`/${slug}/membres`} className="shop-all-button">Tout voir ›</Link>
          </div>
          <div className="shop-row">
            {beatsPrives.map(beat => (
              <BeatCard key={beat.id} beat={beat} slug={slug} queue={[]} estAbonne={estAbonne} clientId={clientId} />
            ))}
          </div>
        </section>
      )}

      {/* Section nouveautés */}
      {beats.length > 0 && (
        <section className="shop-section">
          <div className="shop-section-heading">
            <h2>Nouveautés</h2>
            <Link href={`/${slug}/beats`} className="shop-all-button">Tout voir ›</Link>
          </div>
          <div className="shop-row">
            {beats.slice(0, 10).map(beat => (
              <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} clientId={clientId} />
            ))}
          </div>
        </section>
      )}

      {/* Section sélection du beatmaker */}
      {selection.length > 0 && (
        <section className="shop-section">
          <div className="shop-section-heading">
            <h2>La sélection du beatmaker</h2>
            <Link href={`/${slug}/selection`} className="shop-all-button">Tout voir ›</Link>
          </div>
          <div className="shop-row">
            {selection.slice(0, 10).map(beat => (
              <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} clientId={clientId} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
