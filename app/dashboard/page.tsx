import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeconnexionButton from './DeconnexionButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Bienvenue sur My Producer</h1>
        <p className="text-gray-400 mb-8">Connecté en tant que {user.email}</p>
        <Link
          href="/dashboard/beats/nouveau"
          className="inline-block mb-4 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          + Ajouter un beat
        </Link>
        <div>
          <DeconnexionButton />
        </div>
      </div>
    </main>
  )
}
