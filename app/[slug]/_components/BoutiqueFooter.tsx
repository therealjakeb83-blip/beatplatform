import Link from 'next/link'
import NewsletterForm from './NewsletterForm'

export default function BoutiqueFooter({
  slug,
  nomArtiste,
  logoUrl,
  instagramUrl,
  youtubeUrl,
  tiktokUrl,
}: {
  slug: string
  nomArtiste: string
  logoUrl: string | null
  instagramUrl: string | null
  youtubeUrl: string | null
  tiktokUrl: string | null
}) {
  return (
    <footer className="shop-footer">
      <div className="shop-container shop-footer-grid">
        <div className="shop-footer-col shop-footer-col--brand">
          {logoUrl ? (
            <img src={logoUrl} alt={nomArtiste} className="shop-footer-logo" />
          ) : (
            <div className="shop-logo-fallback">{nomArtiste.slice(0, 2).toUpperCase()}</div>
          )}
          <div className="shop-footer-tagline">Boutique propulsée par votre plateforme</div>
        </div>

        <div className="shop-footer-col">
          <h4>Type beats</h4>
          <Link href={`/${slug}#parcourir-styles`}>Tous les styles</Link>
          <Link href={`/${slug}#parcourir-type-beat`}>Tous les artistes</Link>
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
                <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="shop-social-icon">TK</a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="shop-social-icon">IG</a>
              )}
              {youtubeUrl && (
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="shop-social-icon">YT</a>
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
