import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAbonneBoutique, lienEcouteSiVisible, type BeatEcoute } from '@/lib/ecoute'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import FavorisPlaylist from './FavorisPlaylist'
import { lienBoutiqueServeur } from '@/app/[slug]/_lib/lien-boutique-serveur'

type FavorisBeat = {
  id: string
  titre: string
  image_url: string | null
  mp3_tague_url: string | null
  bpm: number | null
  cle: string | null
}

export default async function FavorisBoutiquePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const lien = await lienBoutiqueServeur(slug)
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(lien(`/mon-compte`))

  const { data } = await admin
    .from('favoris')
    .select('beat_id, beats!inner(id, titre, image_url, mp3_tague_url, bpm, cle, beatmaker_id, statut, supprime_le, date_sortie, hors_vente_collab)')
    .eq('client_id', user.id)
    .eq('beats.beatmaker_id', beatmaker.id)

  // Rang 9f, Lot 1 (P2) : un favori reste affiché, mais n'a d'audio que si
  // le beat est toujours visible pour ce client (ni privé sans abonnement,
  // ni retiré, ni vendu, ni programmé pour plus tard).
  type LigneFavori = FavorisBeat & BeatEcoute
  const lignes = ((data as unknown as { beats: LigneFavori | null }[]) ?? []).map(f => f.beats).filter((b): b is LigneFavori => b !== null)
  const estAbonne = lignes.some(b => b.statut === 'prive') && await estAbonneBoutique(beatmaker.id, slug)
  const beats: FavorisBeat[] = await Promise.all(lignes.map(async b => ({
    id: b.id,
    titre: b.titre,
    image_url: b.image_url,
    bpm: b.bpm,
    cle: b.cle,
    mp3_tague_url: await lienEcouteSiVisible(b, estAbonne),
  })))

  return (
    <div className="min-h-screen bg-black px-6 py-16">
      <div className="max-w-lg mx-auto">
        <Link href={lien(`/mon-compte`)} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
          ← Mon compte
        </Link>

        <h1 className="text-2xl font-black text-white mb-6">
          Mes favoris ({beats.length})
        </h1>

        {beats.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm mb-4">Aucun beat liké sur cette boutique.</p>
            <Link href={lien()} className="text-brand-400 hover:text-brand-300 text-sm transition-colors">
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
