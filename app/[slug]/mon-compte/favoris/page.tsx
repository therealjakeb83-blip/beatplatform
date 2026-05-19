import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import FavorisPlaylist from './FavorisPlaylist'

type FavorisBeat = {
  id: string
  titre: string
  image_url: string | null
  mp3_tague_url: string | null
  bpm: number | null
  cle: string | null
}

type FavoriRow = {
  beat_id: string
  beats: FavorisBeat | null
}

export default async function FavorisBoutiquePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${slug}/mon-compte`)

  const { data } = await admin
    .from('favoris')
    .select('beat_id, beats!inner(id, titre, image_url, mp3_tague_url, bpm, cle, beatmaker_id)')
    .eq('client_id', user.id)
    .eq('beats.beatmaker_id', beatmaker.id)

  const favoris = (data as unknown as FavoriRow[]) ?? []
  const beats = favoris.map(f => f.beats).filter((b): b is FavorisBeat => b !== null)

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-16">
      <div className="max-w-lg mx-auto">
        <Link href={`/${slug}/mon-compte`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Mon compte
        </Link>

        <h1 className="text-2xl font-black text-white mb-6">
          Mes favoris ({beats.length})
        </h1>

        {beats.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm mb-4">Aucun beat liké sur cette boutique.</p>
            <Link href={`/${slug}`} className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              Découvrir les beats →
            </Link>
          </div>
        ) : (
          <FavorisPlaylist beats={beats} slug={slug} />
        )}
      </div>
    </div>
  )
}
