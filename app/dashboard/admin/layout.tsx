import { redirect } from 'next/navigation'
import Link from 'next/link'
import { estAdmin } from '@/lib/admin'

// V1 minimaliste : un seul outil (Catégories) pour l'instant, le reste du
// périmètre Admin (support, gestion boutiques, analytics plateforme, mails
// transactionnels) sera ajouté au fur et à mesure — voir ROADMAP.md étape 15.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await estAdmin())) redirect('/dashboard/business')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/admin" className="text-sm font-bold text-white">Admin</Link>
        <Link href="/dashboard/admin/categories" className="text-sm text-gray-400 hover:text-white transition-colors">Catégories</Link>
        <Link href="/dashboard/business" className="ml-auto text-sm text-gray-500 hover:text-gray-300 transition-colors">← Business</Link>
      </div>
      {children}
    </div>
  )
}
