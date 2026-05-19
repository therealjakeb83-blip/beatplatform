import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type FavoriRow = {
  beat_id: string
  beats: { id: string; titre: string; image_url: string | null } | null
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
    .select('beat_id, beats!inner(id, titre, image_url, beatmaker_id)')
    .eq('client_id', user.id)
    .eq('beats.beatmaker_id', beatmaker.id)

  const favoris = (data as unknown as FavoriRow[]) ?? []

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-16">
      <div className="max-w-lg mx-auto">
        <Link href={`/${slug}/mon-compte`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Mon compte
        </Link>

        <h1 className="text-2xl font-black text-white mb-6">
          Mes favoris ({favoris.length})
        </h1>

        {favoris.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm mb-4">Aucun beat liké sur cette boutique.</p>
            <Link href={`/${slug}`} className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              Découvrir les beats →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {favoris.map(fav => {
              const beat = fav.beats
              return (
                <Link
                  key={fav.beat_id}
                  href={`/${slug}/${fav.beat_id}`}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors"
                >
                  {beat?.image_url ? (
                    <img src={beat.image_url} alt={beat.titre ?? ''} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {beat?.titre?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                  )}
                  <p className="text-white text-sm font-medium truncate flex-1">{beat?.titre ?? 'Beat'}</p>
                  <span className="text-red-400 text-base flex-shrink-0">♥</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
