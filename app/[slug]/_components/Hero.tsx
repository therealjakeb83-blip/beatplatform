'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { peutAfficherCtaAbonnement } from '../_lib/abonnement'

export default function Hero({
  slug,
  nomArtiste,
  heroTitre,
  heroSousTitre,
  tagline,
  aboActif,
}: {
  slug: string
  nomArtiste: string
  heroTitre: string | null
  heroSousTitre: string | null
  tagline: string | null
  aboActif: boolean
}) {
  const titre = heroTitre || `Trouve une instru composée par ${nomArtiste}, pour ton projet`
  const sousTitre = heroSousTitre || tagline || 'Des beats de qualité pour donner vie à tes projets.'
  const afficherCta = peutAfficherCtaAbonnement({ abo_actif: aboActif })

  // Premier scroll molette depuis le tout haut de page : on saute directement
  // au sommet de la première catégorie plutôt que de laisser l'utilisateur
  // scroller manuellement à travers tout le padding du héro (fallait 2 crans
  // de molette avant cet effet).
  useEffect(() => {
    let dejaDeclenche = false
    function onWheel(e: WheelEvent) {
      if (dejaDeclenche || window.scrollY > 10 || e.deltaY <= 0) return
      dejaDeclenche = true
      e.preventDefault()
      document.querySelector('#catalogue > :first-child')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <section className="shop-hero" id="top">
      <div className="shop-hero-content">
        <h1>{titre}</h1>
        <p>{sousTitre}</p>
        {afficherCta && (
          <Link href={`/${slug}/abonnement`} className="shop-cta shop-cta-hero">
            + Devenir membre gratuitement 👑
          </Link>
        )}
      </div>
      <a href="#catalogue" className="shop-down-arrow" aria-label="Descendre">
        <svg width="16" height="9" viewBox="0 0 16 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1L8 8L15 1" />
        </svg>
      </a>
    </section>
  )
}
