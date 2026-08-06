'use client'

import BeatCard, { type BeatPublic } from '../../_components/BeatCard'
import type { BeatMin } from '../../_components/PlayerContext'
import { useDragScroll } from '../../_lib/useDragScroll'

export default function MemeStyleSection({
  slug,
  beats,
  estAbonne,
}: {
  slug: string
  beats: BeatPublic[]
  estAbonne: boolean
}) {
  const rowRef = useDragScroll<HTMLDivElement>()

  if (beats.length === 0) return null

  const queue: BeatMin[] = beats

  return (
    <section className="shop-section">
      <div className="shop-section-heading">
        <h2>Dans le même style</h2>
      </div>
      <div className="shop-row shop-row--beats" ref={rowRef} data-hscroll>
        {beats.map(beat => (
          <BeatCard key={beat.id} beat={beat} slug={slug} queue={queue} estAbonne={estAbonne} />
        ))}
      </div>
    </section>
  )
}
