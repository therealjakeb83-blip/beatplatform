import { redirect } from 'next/navigation'
import Link from 'next/link'
import { estAdmin } from '@/lib/admin'

// Lot 1 de l'Étape 15 (2026-07-24) : Recherche/Support + Log Stripe +
// Suspendre/Réactiver une boutique, en plus des Catégories déjà en place.
// Le reste du périmètre (analytics plateforme, mails transactionnels, veille
// des mises à jour) sera ajouté au fur et à mesure — voir ROADMAP.md étape 15.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await estAdmin())) redirect('/dashboard/business')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-sm font-bold text-white">Admin</Link>
        <Link href="/dashboard/admin/recherche" className="text-sm text-gray-400 hover:text-white transition-colors">Recherche</Link>
        <Link href="/dashboard/admin/categories" className="text-sm text-gray-400 hover:text-white transition-colors">Catégories</Link>
        <Link href="/dashboard/admin/stripe-events" className="text-sm text-gray-400 hover:text-white transition-colors">Log Stripe</Link>
        <Link href="/dashboard/business" className="ml-auto text-sm text-gray-500 hover:text-gray-300 transition-colors">← Business</Link>
      </div>
      {children}
    </div>
  )
}
