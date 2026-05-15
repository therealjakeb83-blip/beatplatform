import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfilForm from './ProfilForm'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profil } = await supabase
    .from('beatmakers')
    .select('slug, nom_artiste, tagline, logo_url, instagram_url, youtube_url, tiktok_url')
    .eq('id', user.id)
    .single()

  if (!profil) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-lg mx-auto">
        <Link
          href="/dashboard"
          className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mb-8">Mon profil</h1>
        <ProfilForm profil={profil} />
      </div>
    </main>
  )
}
