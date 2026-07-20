'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CartBadge from './CartBadge'
import { peutAfficherCtaAbonnement } from '../_lib/abonnement'

export default function BoutiqueHeader({
  slug,
  nomArtiste,
  logoUrl,
  aboActif,
  clientUser,
}: {
  slug: string
  nomArtiste: string
  logoUrl: string | null
  aboActif: boolean
  clientUser: { prenom: string; nom: string } | null
}) {
  const router = useRouter()
  const [sticky, setSticky] = useState(false)
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    function onScroll() {
      setSticky(window.scrollY > 60)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const afficherCta = peutAfficherCtaAbonnement({ abo_actif: aboActif })

  function soumettreRecherche(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/${slug}/beats${recherche ? `?q=${encodeURIComponent(recherche)}` : ''}`)
  }

  return (
    <header className={`shop-header ${sticky ? 'is-sticky' : ''}`}>
      <div className="shop-container shop-header-main">
        <Link href={`/${slug}`} aria-label="Accueil">
          {logoUrl ? (
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
            placeholder="Recherche de produits..."
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
            ＋ Devenir membre gratuitement👑
          </Link>
        )}

        <div className="shop-header-icons">
          <CartBadge />
          <Link
            href={clientUser ? `/${slug}/mon-compte` : `/artiste/connexion?redirect=/${slug}`}
            className="shop-icon-btn"
            aria-label="Compte"
          >
            <svg viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>
            </svg>
          </Link>
        </div>
      </div>

      <nav className="shop-container shop-header-sub">
        <Link href={`/${slug}#parcourir-type-beat`} className="shop-pill">Type beat</Link>
        <Link href={`/${slug}#parcourir-styles`} className="shop-pill">Styles</Link>
        <Link href={`/${slug}#parcourir-instruments`} className="shop-pill">Instruments</Link>
        <Link href={`/${slug}#parcourir-ambiances`} className="shop-pill">Ambiances</Link>
        <Link href={`/${slug}/membres`} className="shop-pill is-private">Beats privés🔒</Link>
      </nav>
    </header>
  )
}
