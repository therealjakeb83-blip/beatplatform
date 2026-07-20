import Link from 'next/link'
import { TITRE_SECTION, TYPE_DB_VERS_URL, type TypeCategorieDb } from '../_lib/categories-urls'

export type CategorieCarte = { nom: string; count: number; imageUrl: string | null }

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

  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-black text-white mb-5">{TITRE_SECTION[type]}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cartes.map(carte => (
          <Link
            key={carte.nom}
            href={`/${slug}/parcourir/${TYPE_DB_VERS_URL[type]}/${encodeURIComponent(carte.nom)}`}
            className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-2xl overflow-hidden transition-all block"
          >
            <div className="relative aspect-square">
              {carte.imageUrl ? (
                <img
                  src={carte.imageUrl}
                  alt={carte.nom}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-2xl font-black text-gray-500">
                  {carte.nom.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="font-bold text-white truncate text-sm">{carte.nom}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {carte.count} beat{carte.count !== 1 ? 's' : ''}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
