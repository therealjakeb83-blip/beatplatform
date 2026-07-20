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
  if (cartes.length === 0) return null

  function href(nom: string) {
    return `/${slug}/parcourir/${TYPE_DB_VERS_URL[type]}/${encodeURIComponent(nom)}`
  }

  return (
    <section id={id} className="shop-section">
      <div className="shop-section-heading">
        <h2>{TITRE_SECTION[type]}</h2>
      </div>

      {/* Styles/instruments — même traitement sur jakebmusic.com : image
          + libellé centré, 160px. */}
      {(type === 'styles' || type === 'instruments') && (
        <div className="shop-row">
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-tile-card">
              {carte.imageUrl ? (
                <img src={carte.imageUrl} alt={carte.nom} />
              ) : (
                <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
              )}
              <div className="shop-tile-label">
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

      {/* Ambiances — même taille que styles/instruments (160px), libellé
          en bas à gauche avec compteur en pastille. */}
      {type === 'ambiances' && (
        <div className="shop-row">
          {cartes.map(carte => (
            <Link key={carte.nom} href={href(carte.nom)} className="shop-mood-card">
              {carte.imageUrl ? (
                <img src={carte.imageUrl} alt={carte.nom} />
              ) : (
                <div className="shop-beat-fallback">{initiales(carte.nom)}</div>
              )}
              <div className="shop-mood-label">
                {carte.nom.toUpperCase()}
                <span>{carte.count} titre{carte.count !== 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
