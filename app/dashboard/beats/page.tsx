import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CatalogueBeatsList from './CatalogueBeatsList'
import Link from 'next/link'

export default async function CataloguePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beats } = await supabase
    .from('beats')
    .select('id, titre, bpm, cle, statut, image_url, created_at, date_sortie, styles, type_beat, mp3_tague_url')
    .eq('beatmaker_id', user.id)
    .is('supprime_le', null)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-2">Mes beats</h1>
          </div>
          <Link
            href="/dashboard/beats/nouveau"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
          >
            + Ajouter un beat
          </Link>
        </div>

        <CatalogueBeatsList beats={beats ?? []} />
      </div>
    </main>
  )
}
