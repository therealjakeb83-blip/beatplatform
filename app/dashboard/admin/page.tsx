import Link from 'next/link'

export default function AdminPage() {
  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8">
      <h1 className="text-xl font-bold text-white mb-1">Admin</h1>
      <p className="text-sm text-gray-500 mb-6">Back-office plateforme — minimaliste pour l&apos;instant, complété au fur et à mesure.</p>
      <Link
        href="/dashboard/admin/categories"
        className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 max-w-xs transition-colors"
      >
        <p className="text-sm font-semibold text-white">Catégories</p>
        <p className="text-xs text-gray-500 mt-0.5">Demandes de certification + gestion des catégories officielles</p>
      </Link>
    </div>
  )
}
