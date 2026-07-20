import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeconnexionButton from './DeconnexionButton'
import { estAdmin } from '@/lib/admin'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const [{ data: beatmaker }, admin] = await Promise.all([
    supabase.from('beatmakers').select('slug').eq('id', user.id).single(),
    estAdmin(),
  ])

return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Bienvenue sur My Producer</h1>
        <p className="text-gray-400 mb-8">Connecté en tant que {user.email}</p>
        <div className="flex flex-wrap gap-3 justify-center mb-4">
          <Link
            href="/dashboard/business"
            className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            Business ↗
          </Link>
          <Link
            href="/dashboard/profil"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Mon profil
          </Link>
          <Link
            href="/dashboard/paiements"
            className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Paiements
          </Link>
          {beatmaker?.slug && (
            <Link
              href={`/${beatmaker.slug}`}
              target="_blank"
              className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors flex items-center gap-2"
            >
              Ma boutique ↗
            </Link>
          )}
          {admin && (
            <Link
              href="/dashboard/admin"
              className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
            >
              Admin
            </Link>
          )}
        </div>
        <div>
          <DeconnexionButton />
        </div>
      </div>
    </main>
  )
}
