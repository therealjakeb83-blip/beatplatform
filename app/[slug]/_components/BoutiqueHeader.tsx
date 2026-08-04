'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CartBadge from './CartBadge'
import { peutAfficherCtaAbonnement } from '../_lib/abonnement'
import { estMarqueAffichageValide, estStyleNomMarqueValide, type MarqueAffichage, type StyleNomMarque } from '../_lib/marque'

export default function BoutiqueHeader({
  slug,
  nomArtiste,
  logoUrl,
  marqueAffichage,
  styleNomMarque,
  aboActif,
  clientUser,
}: {
  slug: string
  nomArtiste: string
  logoUrl: string | null
  marqueAffichage: MarqueAffichage
  styleNomMarque: StyleNomMarque
  aboActif: boolean
  clientUser: { prenom: string; nom: string } | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [recherche, setRecherche] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Aperçu live depuis la page Personnalisation (mêmes query params que
  // theme_apercu pour l'accent — voir BoutiqueThemeRoot.tsx).
  const marqueApercu = searchParams.get('marque_apercu')
  const marque = marqueApercu && estMarqueAffichageValide(marqueApercu) ? marqueApercu : marqueAffichage
  const styleApercu = searchParams.get('style_apercu')
  const style = styleApercu && estStyleNomMarqueValide(styleApercu) ? styleApercu : styleNomMarque

  const afficherCta = peutAfficherCtaAbonnement({ abo_actif: aboActif })

  // Header dynamique (desktop) : caché en descente, réaffiché en remontée
  // ou près du haut de page — cf. handoff_modifs_v2/commun/header-dynamique.js
  useEffect(() => {
    const header = wrapRef.current
    if (!header) return
    let lastY = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const dy = y - lastY
      if (y < 80) header!.classList.remove('is-hidden')
      else if (dy > 4) header!.classList.add('is-hidden')
      else if (dy < -4) header!.classList.remove('is-hidden')
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function soumettreRecherche(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/${slug}/beats${recherche ? `?q=${encodeURIComponent(recherche)}` : ''}`)
  }

  return (
    <div className="shop-header-wrap" ref={wrapRef}>
      <header className="shop-header">
        <div className="shop-header-row1">
          <Link href={`/${slug}`} aria-label="Accueil">
            {marque === 'nom' && nomArtiste ? (
              <span className={`shop-wordmark shop-wordmark--${style}`}>{nomArtiste}</span>
            ) : logoUrl ? (
              <img className="shop-logo" src={logoUrl} alt={nomArtiste} />
            ) : (
              <div className="shop-logo-fallback">{nomArtiste.slice(0, 2).toUpperCase()}</div>
            )}
          </Link>

          <form className="shop-search" onSubmit={soumettreRecherche}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2}>
              <circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>
            </svg>
            <input
              type="search"
              placeholder="Recherche de beats…"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
            />
          </form>

          <nav className="shop-header-links">
            <Link href={`/${slug}/comment-ca-marche`}>Comment ça marche ?</Link>
            <Link href={`/${slug}/licences`}>Licences</Link>
          </nav>

          {afficherCta && (
            <Link href={`/${slug}/abonnement`} className="shop-cta">
              + Devenir membre gratuitement 👑
            </Link>
          )}

          <div className="shop-header-icons">
            <CartBadge />
            <Link
              href={clientUser ? `/${slug}/mon-compte` : `/artiste/connexion?redirect=/${slug}`}
              className="shop-icon-btn"
              aria-label="Compte"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" strokeLinecap="round"></path>
              </svg>
            </Link>
          </div>
        </div>

        <nav className="shop-header-row2">
          <Link href={`/${slug}#parcourir-type-beat`} className="shop-pill">Type beat</Link>
          <Link href={`/${slug}#parcourir-styles`} className="shop-pill">Styles</Link>
          <Link href={`/${slug}#parcourir-instruments`} className="shop-pill">Instruments</Link>
          <Link href={`/${slug}#parcourir-ambiances`} className="shop-pill">Ambiances</Link>
          <Link href={`/${slug}/membres`} className="shop-pill is-private">Beats privés 🔒</Link>
        </nav>
      </header>
    </div>
  )
}
