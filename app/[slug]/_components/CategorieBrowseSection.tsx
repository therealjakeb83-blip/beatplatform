'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { TITRE_SECTION, TYPE_DB_VERS_URL, type TypeCategorieDb } from '../_lib/categories-urls'

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
  const rowRef = useRef<HTMLDivElement>(null)

  if (cartes.length === 0) return null

  function href(nom: string) {
    return `/${slug}/parcourir/${TYPE_DB_VERS_URL[type]}/${encodeURIComponent(nom)}`
  }

  function scrollRow(direction: number) {
    rowRef.current?.scrollBy({ left: direction * 420, behavior: 'smooth' })
  }

  return (
    <section id={id} className="shop-section">
      <div className="shop-section-heading">
        <h2>{TITRE_SECTION[type]}</h2>
      </div>

      {type === 'styles' && (
        <div className="shop-row">
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-style-card">
              <div>
                <strong>{carte.nom}</strong>
                <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
              </div>
            </Link>
          ))}
        </div>
      )}

      {type === 'type_beat' && (
        <div className="shop-row">
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-artist-card">
              {carte.imageUrl ? (
                <img src={carte.imageUrl} alt={carte.nom} />
              ) : (
                <div className="shop-beat-fallback" style={{ borderRadius: '50%' }}>{initiales(carte.nom)}</div>
              )}
              <strong>{carte.nom}</strong>
              <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
            </Link>
          ))}
        </div>
      )}

      {type === 'instruments' && (
        <div className="shop-row">
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-instrument-card">
              {carte.imageUrl ? (
                <img src={carte.imageUrl} alt={carte.nom} />
              ) : (
                <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
              )}
              <div className="shop-instrument-label">
                <strong>{carte.nom}</strong>
                <small>{carte.count} titre{carte.count !== 1 ? 's' : ''}</small>
              </div>
            </Link>
          ))}
        </div>
      )}

      {type === 'ambiances' && (
        <div className="shop-row shop-mood-row" ref={rowRef}>
          {cartes.map((carte, i) => (
            <Link
              key={carte.nom}
              href={href(carte.nom)}
              className={`shop-mood-card ${i === 0 ? '' : 'is-small'}`}
            >
              {carte.imageUrl ? (
                <img src={carte.imageUrl} alt={carte.nom} />
              ) : (
                <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
              )}
              <div className="shop-mood-label">
                {carte.nom.toUpperCase()} <span>{carte.count} titre{carte.count !== 1 ? 's' : ''}</span>
              </div>
              {i === 0 && (
                <div className="shop-mood-arrows">
                  <button
                    className="shop-mood-arrow"
                    onClick={e => { e.preventDefault(); scrollRow(-1) }}
                    aria-label="Précédent"
                  >‹</button>
                  <button
                    className="shop-mood-arrow"
                    onClick={e => { e.preventDefault(); scrollRow(1) }}
                    aria-label="Suivant"
                  >›</button>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
