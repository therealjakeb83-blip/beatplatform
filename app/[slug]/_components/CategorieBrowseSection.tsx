'use client'

import Link from 'next/link'
import { TITRE_SECTION, TYPE_DB_VERS_URL, type TypeCategorieDb } from '../_lib/categories-urls'
import { useDragScroll } from '../_lib/useDragScroll'

export type CategorieCarte = { nom: string; count: number; imageUrl: string | null }

function initiales(nom: string) {
  return nom.slice(0, 2).toUpperCase()
}

// Les 9 ambiances du pack design (photo N&B + masque de halo coloré,
// voir ambiances-export/README.md) — seules celles-ci ont un masque
// disponible dans public/img/ambiances/masks/. Une ambiance créée par un
// beatmaker (nom hors de cette liste) retombe sur l'ancien rendu photo+scrim.
const AMBIANCE_SLUGS = new Set([
  'agressif', 'bouncy', 'calme', 'energique', 'love',
  'melancolique', 'planant', 'sombre', 'triste',
])

function slugAmbiance(nom: string): string | null {
  const slug = nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  return AMBIANCE_SLUGS.has(slug) ? slug : null
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
                  <img src={carte.imageUrl} alt={carte.nom} draggable={false} />
                ) : (
                  <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
                )}
              </div>
              <div className="shop-artist-card-info">
                <strong>{carte.nom}</strong>
                <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Instruments — dégradé --g1/--g2 + icône blanche calée à droite. */}
      {type === 'instruments' && (
        <div className="shop-row" ref={rowRef} data-hscroll>
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-instrument-card">
              {carte.imageUrl && (
                <img className="shop-instrument-card__art" src={carte.imageUrl} alt="" aria-hidden="true" draggable={false} />
              )}
              <div className="shop-instrument-card__body">
                <strong>{carte.nom}</strong>
                <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Ambiances — photo N&B + halo coloré masqué sur la couleur d'accent
          de la boutique (paquet design "ambiances", 2026-07-31). Le halo
          n'apparaît que pour les 9 ambiances certifiées du pack (masque
          disponible) ; une ambiance créée par un beatmaker retombe sur le
          rendu photo+scrim d'origine. */}
      {type === 'ambiances' && (
        <div className="shop-row" ref={rowRef} data-hscroll>
          {cartes.map(carte => {
            const slug = slugAmbiance(carte.nom)
            return (
              <Link key={carte.nom} href={href(carte.nom)} className="shop-media-card shop-media-card--ambiance">
                {carte.imageUrl ? (
                  <img src={carte.imageUrl} alt={carte.nom} draggable={false} />
                ) : (
                  <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
                )}
                {slug && (
                  <span
                    className="amb-glow"
                    style={{
                      WebkitMaskImage: `url(/img/ambiances/masks/${slug}.png)`,
                      maskImage: `url(/img/ambiances/masks/${slug}.png)`,
                    }}
                  />
                )}
                <div className="shop-media-card-label">
                  <strong>{carte.nom.toUpperCase()}</strong>
                  <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
