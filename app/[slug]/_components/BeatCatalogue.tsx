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
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-14">

      {/* Section beats membres */}
      {beatsPrives.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black text-white">
              Réservés aux membres{' '}
              <span className="text-gray-500 font-normal text-base">({beatsPrives.length})</span>
            </h2>
            <Link
              href={`/${slug}/membres`}
              className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              Tout voir →
            </Link>
          </div>
          <div className="relative overflow-hidden -mx-6 px-6 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
            <div className="flex gap-4 w-max animate-marquee hover:[animation-play-state:paused]">
              {[...beatsPrives, ...beatsPrives].map((beat, i) => (
                <div
                  key={`${beat.id}-${i}`}
                  className={`w-40 sm:w-48 shrink-0 transition-all duration-300 ${
                    estAbonne ? '' : 'grayscale-[35%] brightness-[0.85] saturate-75 hover:grayscale-0 hover:brightness-100 hover:saturate-100'
                  }`}
                >
                  <BeatCard beat={beat} slug={slug} queue={[]} estAbonne={estAbonne} clientId={clientId} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section nouveautés */}
      {beats.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black text-white">Nouveautés</h2>
            <Link
              href={`/${slug}/beats`}
              className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              Tout voir →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {beats.slice(0, 4).map(beat => (
              <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} clientId={clientId} />
            ))}
          </div>
        </section>
      )}

      {/* Section sélection du beatmaker */}
      {selection.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black text-white">La sélection du beatmaker</h2>
            <Link
              href={`/${slug}/selection`}
              className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              Tout voir →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {selection.slice(0, 4).map(beat => (
              <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} clientId={clientId} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
