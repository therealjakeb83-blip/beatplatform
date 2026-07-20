import Link from 'next/link'
import NewsletterForm from './NewsletterForm'

export default function BoutiqueFooter({
  slug,
  nomArtiste,
  instagramUrl,
  youtubeUrl,
  tiktokUrl,
}: {
  slug: string
  nomArtiste: string
  instagramUrl: string | null
  youtubeUrl: string | null
  tiktokUrl: string | null
}) {
  return (
    <footer className="shop-footer">
      <div className="shop-container shop-footer-grid">
        <div className="shop-footer-col">
          <h4>Beats</h4>
          <Link href={`/${slug}/beats`}>Nouveautés</Link>
          <Link href={`/${slug}/selection`}>Sélection</Link>
          <Link href={`/${slug}/membres`}>Réservés aux membres</Link>
          <Link href={`/${slug}#parcourir-styles`}>Styles</Link>
          <Link href={`/${slug}#parcourir-type-beat`}>Type beats</Link>
          <Link href={`/${slug}#parcourir-instruments`}>Instruments</Link>
          <Link href={`/${slug}#parcourir-ambiances`}>Ambiances</Link>
        </div>

        <div className="shop-footer-col">
          <h4>Compte</h4>
          <Link href={`/${slug}/abonnement`}>Devenir membre</Link>
          <Link href={`/${slug}/mon-compte`}>Mon compte</Link>
          <Link href={`/${slug}/mon-compte/favoris`}>Favoris</Link>
        </div>

        <div className="shop-footer-col">
          <h4>Légal</h4>
          <Link href={`/${slug}/mentions-legales`}>Mentions légales</Link>
          <Link href={`/${slug}/cgv`}>CGV</Link>
          <Link href={`/${slug}/confidentialite`}>Confidentialité</Link>
          {(instagramUrl || youtubeUrl || tiktokUrl) && (
            <div className="shop-socials">
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="shop-social-icon">IG</a>
              )}
              {youtubeUrl && (
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="shop-social-icon">YT</a>
              )}
              {tiktokUrl && (
                <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="shop-social-icon">TK</a>
              )}
            </div>
          )}
        </div>

        <div className="shop-footer-col">
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
