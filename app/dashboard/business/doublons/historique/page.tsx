import Link from 'next/link'

export default function HistoriquePage() {
  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
        <Link href="/dashboard/business/doublons" className="hover:text-white transition-colors">
          Doublons
        </Link>
        <span className="text-gray-700">›</span>
        <span className="text-white">Historique des fusions</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Historique des fusions</h1>
      <p className="text-gray-500 text-sm mb-8">Toutes les fusions de contacts effectuées.</p>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
        <p className="text-gray-600 text-sm">Bientôt disponible</p>
      </div>
    </div>
  )
}
