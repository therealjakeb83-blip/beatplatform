import Link from 'next/link'
import CartBadge from './CartBadge'

export default function BoutiqueNavBar({
  slug,
  clientUser,
}: {
  slug: string
  clientUser: { prenom: string; nom: string } | null
}) {
  return (
    <div className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-end gap-5">
        <CartBadge />
        {clientUser ? (
          <Link
            href={`/${slug}/mon-compte`}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
              {(clientUser.prenom || clientUser.nom || '?').slice(0, 1).toUpperCase()}
            </div>
            <span>Mon compte</span>
          </Link>
        ) : (
          <Link
            href={`/artiste/connexion?redirect=/${slug}`}
            className="text-sm text-gray-500 hover:text-brand-400 transition-colors"
          >
            Se connecter
          </Link>
        )}
      </div>
    </div>
  )
}
