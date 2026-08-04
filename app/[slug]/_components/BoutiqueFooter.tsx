'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import NewsletterForm from './NewsletterForm'
import { estMarqueAffichageValide, estStyleNomMarqueValide, type MarqueAffichage, type StyleNomMarque } from '../_lib/marque'

export default function BoutiqueFooter({
  slug,
  nomArtiste,
  logoUrl,
  marqueAffichage,
  styleNomMarque,
  instagramUrl,
  youtubeUrl,
  tiktokUrl,
}: {
  slug: string
  nomArtiste: string
  logoUrl: string | null
  marqueAffichage: MarqueAffichage
  styleNomMarque: StyleNomMarque
  instagramUrl: string | null
  youtubeUrl: string | null
  tiktokUrl: string | null
}) {
  // Aperçu live depuis la page Personnalisation — mêmes query params que le
  // header (voir BoutiqueHeader.tsx).
  const searchParams = useSearchParams()
  const marqueApercu = searchParams.get('marque_apercu')
  const marque = marqueApercu && estMarqueAffichageValide(marqueApercu) ? marqueApercu : marqueAffichage
  const styleApercu = searchParams.get('style_apercu')
  const style = styleApercu && estStyleNomMarqueValide(styleApercu) ? styleApercu : styleNomMarque

  return (
    <footer className="shop-footer">
      <div className="shop-container shop-footer-grid">
        <div className="shop-footer-col shop-footer-col--brand">
          {marque === 'nom' && nomArtiste ? (
            <span className={`shop-footer-wordmark shop-wordmark--${style}`}>{nomArtiste}</span>
          ) : logoUrl ? (
            <img src={logoUrl} alt={nomArtiste} className="shop-footer-logo" />
          ) : (
            <div className="shop-logo-fallback">{nomArtiste.slice(0, 2).toUpperCase()}</div>
          )}
          <div className="shop-footer-tagline">Boutique propulsée par votre plateforme</div>
        </div>

        <div className="shop-footer-col">
          <h4>Type beats</h4>
          <Link href={`/${slug}#parcourir-styles`}>Tous les styles</Link>
          <Link href={`/${slug}#parcourir-type-beat`}>Tous les type beats</Link>
          <Link href={`/${slug}#parcourir-instruments`}>Tous les instruments</Link>
          <Link href={`/${slug}#parcourir-ambiances`}>Toutes les ambiances</Link>
          <Link href={`/${slug}/membres`}>Réservé aux abonnés</Link>
        </div>

        <div className="shop-footer-col">
          <h4>Devenir abonné</h4>
          <Link href={`/${slug}/comment-ca-marche`}>Comment ça marche ?</Link>
          <Link href={`/${slug}/abonnement`}>Abonnements</Link>
          <Link href={`/${slug}/licences`}>Licences</Link>
          <Link href={`/${slug}/mon-compte/favoris`}>Favoris</Link>
        </div>

        <div className="shop-footer-col">
          <Link href={`/${slug}/plan-de-site`}>Plan de site</Link>
          <Link href={`/${slug}/mon-compte`}>Mon compte</Link>
          <Link href={`/${slug}/contact`}>Contact</Link>
          <Link href={`/${slug}/confidentialite`}>Politique de confidentialité</Link>
          <Link href={`/${slug}/cgv`}>CGV</Link>
          <Link href={`/${slug}/mentions-legales`}>Mentions légales</Link>
        </div>

        <div className="shop-footer-col">
          {(instagramUrl || youtubeUrl || tiktokUrl) && (
            <div className="shop-socials">
              {tiktokUrl && (
                <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="shop-social-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.1v12.05a2.6 2.6 0 1 1-1.86-2.5V9.4a5.66 5.66 0 1 0 4.96 5.62V8.9a7.3 7.3 0 0 0 4.06 1.23V7.03a4.3 4.3 0 0 1-2.99-1.21z" /></svg>
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="shop-social-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.9" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.9" /><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" /></svg>
                </a>
              )}
              {youtubeUrl && (
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="shop-social-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" strokeWidth="1.9" /><path d="M10.5 9.5l4.5 2.5-4.5 2.5v-5z" fill="currentColor" /></svg>
                </a>
              )}
            </div>
          )}
          <h4>Newsletter</h4>
          <NewsletterForm slug={slug} />
        </div>
      </div>

      <div className="shop-container shop-footer-bottom">
        © {new Date().getFullYear()} {nomArtiste}
      </div>
    </footer>
  )
}
