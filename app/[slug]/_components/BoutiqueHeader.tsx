'use client'

import { useState } from 'react'
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
  const [recherche, setRecherche] = useState('')

  const afficherCta = peutAfficherCtaAbonnement({ abo_actif: aboActif })

  function soumettreRecherche(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/${slug}/beats${recherche ? `?q=${encodeURIComponent(recherche)}` : ''}`)
  }

  return (
    <div className="shop-header-wrap">
      <header className="shop-header">
        <div className="shop-header-row1">
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
