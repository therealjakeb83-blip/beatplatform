import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type FavoriRow = {
  id: string
  created_at: string
  beats: {
    id: string
    titre: string
    bpm: number | null
    cle: string | null
    image_url: string | null
    beatmaker_id: string
    beatmakers: { nom_artiste: string; slug: string } | null
  } | null
}

export default async function MesFavorisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/artiste/connexion?redirect=/mon-compte/favoris')

  const admin = createAdminClient()

  const { data: favoris } = await admin
    .from('favoris')
    .select('id, created_at, beats(id, titre, bpm, cle, image_url, beatmaker_id, beatmakers(nom_artiste, slug))')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/mon-compte" className="text-gray-500 hover:text-white text-sm transition-colors">
            ← Mon compte
          </Link>
        </div>

        <h1 className="text-2xl font-black text-white mb-8">
          Mes favoris{' '}
          <span className="text-gray-500 font-normal text-base">({favoris?.length ?? 0})</span>
        </h1>

        {!favoris?.length ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">♡</div>
            <p className="text-gray-400 text-sm">Tu n&apos;as pas encore liké de beats.</p>
            <p className="text-gray-600 text-xs mt-2">
              Clique sur le cœur d&apos;un beat pour l&apos;ajouter à tes favoris.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(favoris as unknown as FavoriRow[]).map(fav => {
              const beat = fav.beats
              if (!beat) return null
              const bm = beat.beatmakers
              return (
                <Link
                  key={fav.id}
                  href={bm?.slug ? `/${bm.slug}/${beat.id}` : '#'}
                  className="flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors group"
                >
                  {beat.image_url ? (
                    <img src={beat.image_url} alt={beat.titre} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-800 flex-shrink-0 flex items-center justify-center text-gray-500 text-sm font-black">
                      {beat.titre.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate group-hover:text-indigo-300 transition-colors">
                      {beat.titre}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {bm?.nom_artiste ?? 'Beatmaker'}
                      {beat.bpm && ` · ${beat.bpm} BPM`}
                      {beat.cle && ` · ${beat.cle}`}
                    </p>
                  </div>
                  <span className="text-rose-500 text-lg flex-shrink-0">♥</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
