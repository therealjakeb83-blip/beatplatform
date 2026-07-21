'use client'

import Link from 'next/link'
import { TITRE_SECTION, TYPE_DB_VERS_URL, type TypeCategorieDb } from '../_lib/categories-urls'
import { useDragScroll } from '../_lib/useDragScroll'

export type CategorieCarte = { nom: string; count: number; imageUrl: string | null }

function initiales(nom: string) {
  return nom.slice(0, 2).toUpperCase()
}

export default function CategorieBrowseSection({
  id,
  type,
  slug,
  cartes,
}: {
  id: string
  type: TypeCategorieDb
  slug: string
  cartes: CategorieCarte[]
}) {
  const rowRef = useDragScroll<HTMLDivElement>()

  if (cartes.length === 0) return null

  function href(nom: string) {
    return `/${slug}/parcourir/${TYPE_DB_VERS_URL[type]}/${encodeURIComponent(nom)}`
  }

  return (
    <section id={id} className="shop-section">
      <div className="shop-section-heading">
        <h2>{TITRE_SECTION[type]}</h2>
      </div>

      {/* Styles — carte gradient dérivée de l'accent, sans image. */}
      {type === 'styles' && (
        <div className="shop-row" ref={rowRef} data-hscroll>
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-style-card">
              <strong>{carte.nom}</strong>
              <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
            </Link>
          ))}
        </div>
      )}

      {/* Type beat — cercles photo. */}
      {type === 'type_beat' && (
        <div className="shop-row shop-row--artists" ref={rowRef} data-hscroll>
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-artist-card">
              <div className="shop-artist-card-photo">
                {carte.imageUrl ? (
                  <img src={carte.imageUrl} alt={carte.nom} />
                ) : (
                  <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
                )}
              </div>
              <strong>{carte.nom}</strong>
              <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
            </Link>
          ))}
        </div>
      )}

      {/* Instruments — bandeau 296×120, photo + scrim bas. */}
      {type === 'instruments' && (
        <div className="shop-row" ref={rowRef} data-hscroll>
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-media-card shop-media-card--instrument">
              {carte.imageUrl ? (
                <img src={carte.imageUrl} alt={carte.nom} />
              ) : (
                <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
              )}
              <div className="shop-media-card-label">
                <strong>{carte.nom}</strong>
                <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Ambiances — grand bandeau 620×150, même traitement. */}
      {type === 'ambiances' && (
        <div className="shop-row" ref={rowRef} data-hscroll>
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-media-card shop-media-card--ambiance">
              {carte.imageUrl ? (
                <img src={carte.imageUrl} alt={carte.nom} />
              ) : (
                <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
              )}
              <div className="shop-media-card-label">
                <strong>{carte.nom.toUpperCase()}</strong>
                <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
