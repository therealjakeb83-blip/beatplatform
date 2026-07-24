import Link from 'next/link'

export default function AdminPage() {
  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-white mb-1">Admin</h1>
      <p className="text-sm text-gray-500 mb-6">Back-office plateforme — complété au fur et à mesure (voir ROADMAP.md, étape 15).</p>
      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
        <Link
          href="/dashboard/admin/recherche"
          className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 transition-colors"
        >
          <p className="text-sm font-semibold text-white">Recherche</p>
          <p className="text-xs text-gray-500 mt-0.5">Retrouver une boutique, un client, une commande ou un abonnement</p>
        </Link>
        <Link
          href="/dashboard/admin/categories"
          className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 transition-colors"
        >
          <p className="text-sm font-semibold text-white">Catégories</p>
          <p className="text-xs text-gray-500 mt-0.5">Demandes de certification + gestion des catégories officielles</p>
        </Link>
        <Link
          href="/dashboard/admin/stripe-events"
          className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 transition-colors"
        >
          <p className="text-sm font-semibold text-white">Log Stripe</p>
          <p className="text-xs text-gray-500 mt-0.5">Derniers événements webhook reçus, succès et échecs</p>
        </Link>
      </div>
    </div>
  )
}
