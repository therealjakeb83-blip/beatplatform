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

  return (
    <section className="shop-hero" id="top">
      <div className="shop-container shop-hero-content">
        <h1>{titre}</h1>
        <p>{sousTitre}</p>
        {afficherCta && (
          <Link href={`/${slug}/abonnement`} className="shop-cta shop-cta-hero">
            + Devenir membre gratuitement 👑
          </Link>
        )}
      </div>
      <a href="#catalogue" className="shop-down-arrow" aria-label="Descendre">⌄</a>
    </section>
  )
}
