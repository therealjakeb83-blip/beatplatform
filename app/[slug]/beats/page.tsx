import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CatalogueClient from './_components/CatalogueClient'
import type { BeatPublic, LicencePublic } from '../_components/BeatCard'

export default async function CataloguePage({
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

  const now = new Date().toISOString()

  const { data: rawBeats } = await supabase
    .from('beats')
    .select(`
      id, titre, bpm, cle, image_url, mp3_tague_url, free_download_actif,
      styles, ambiances, instruments, type_beat,
      beat_licences (
        actif, prix_override, sur_demande,
        licences (id, nom, modele, prix, actif)
      )
    `)
    .eq('beatmaker_id', beatmaker.id)
    .eq('statut', 'public')
    .is('supprime_le', null)
    .or(`date_sortie.is.null,date_sortie.lte.${now}`)
    .order('created_at', { ascending: false })

  type RawBeat = { id: string; titre: string; bpm: number | null; cle: string | null; image_url: string | null; mp3_tague_url: string | null; free_download_actif: boolean; styles: string[] | null; ambiances: string[] | null; instruments: string[] | null; type_beat: string[] | null; beat_licences: { actif: boolean; prix_override: number | null; sur_demande: boolean; licences: { id: string; nom: string; modele: string; prix: number; actif: boolean } | null }[] | null }

  const beats: BeatPublic[] = (rawBeats as unknown as RawBeat[] ?? []).map(beat => ({
    id: beat.id,
    titre: beat.titre,
    bpm: beat.bpm,
    cle: beat.cle,
    image_url: beat.image_url,
    mp3_tague_url: beat.mp3_tague_url,
    free_download_actif: beat.free_download_actif,
    styles: beat.styles,
    ambiances: beat.ambiances,
    instruments: beat.instruments,
    type_beat: beat.type_beat,
    prive: false,
    licences: (beat.beat_licences ?? [])
      .filter(bl => bl.actif && bl.licences?.actif)
      .map((bl): LicencePublic => ({
        id: bl.licences!.id,
        nom: bl.licences!.nom,
        modele: bl.licences!.modele,
        prix: bl.prix_override ?? bl.licences!.prix,
        sur_demande: bl.sur_demande,
      })),
  }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link href={`/${slug}`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
        ← Boutique de {beatmaker.nom_artiste}
      </Link>

      <h1 className="text-2xl font-black text-white mb-6">
        Catalogue <span className="text-gray-500 font-normal text-lg">({beats.length})</span>
      </h1>

      <CatalogueClient beats={beats} slug={slug} estAbonne={false} />
    </div>
  )
}
