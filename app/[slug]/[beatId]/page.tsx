import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LicencesTable from '../_components/LicencesTable'
import BeatDetailPlayButton from '../_components/BeatDetailPlayButton'
import type { LicencePublic } from '../_components/BeatCard'

export default async function BeatDetailPage({
  params,
}: {
  params: Promise<{ slug: string; beatId: string }>
}) {
  const { slug, beatId } = await params
  const supabase = await createClient()

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id, nom_artiste, slug')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  const { data: beat } = await supabase
    .from('beats')
    .select(`
      id, titre, bpm, cle, image_url, mp3_tague_url,
      styles, ambiances, instruments, type_beat,
      beat_licences (
        actif, prix_override, sur_demande,
        licences (
          id, nom, modele, prix, actif, ordre,
          inclut_mp3, inclut_wav, inclut_stems,
          streams_limite, vues_video_limite, clips_video_limite, est_exclusive
        )
      )
    `)
    .eq('id', beatId)
    .eq('beatmaker_id', beatmaker.id)
    .eq('statut', 'public')
    .is('supprime_le', null)
    .single()

  if (!beat) notFound()

  type RawBeatLicence = {
    actif: boolean
    prix_override: number | null
    sur_demande: boolean
    licences: {
      id: string
      nom: string
      modele: string
      prix: number
      actif: boolean
      ordre: number | null
      inclut_mp3: boolean
      inclut_wav: boolean
      inclut_stems: boolean
      streams_limite: number | null
      vues_video_limite: number | null
      clips_video_limite: number | null
      est_exclusive: boolean
    } | null
  }

  const licences = ((beat.beat_licences ?? []) as RawBeatLicence[])
    .filter(bl => bl.actif && bl.licences?.actif)
    .map(bl => ({
      ...(bl.licences!),
      prix: bl.prix_override ?? bl.licences!.prix,
      sur_demande: bl.sur_demande,
    } satisfies LicencePublic & {
      streams_limite: number | null
      vues_video_limite: number | null
      clips_video_limite: number | null
      est_exclusive: boolean
      inclut_mp3: boolean
      inclut_wav: boolean
      inclut_stems: boolean
    }))

  const tags = [
    ...(beat.type_beat ?? []),
    ...(beat.styles ?? []),
    ...(beat.ambiances ?? []),
    ...(beat.instruments ?? []),
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Navigation */}
      <Link
        href={`/${slug}`}
        className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8"
      >
        ← Boutique de {beatmaker.nom_artiste}
      </Link>

      <div className="flex flex-col sm:flex-row gap-8">
        {/* Cover */}
        <div className="w-full sm:w-56 sm:flex-shrink-0">
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-800">
            {beat.image_url ? (
              <img src={beat.image_url} alt={beat.titre} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-600">
                {beat.titre.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-black text-white">{beat.titre}</h1>

          <div className="flex items-center gap-3 mt-2 text-gray-400 text-sm">
            {beat.bpm && <span>{beat.bpm} BPM</span>}
            {beat.bpm && beat.cle && <span>·</span>}
            {beat.cle && <span>{beat.cle}</span>}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {(beat.type_beat ?? []).map((t: string) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-indigo-900/50 text-indigo-300">
                  {t}
                </span>
              ))}
              {(beat.styles ?? []).map((s: string) => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-400">
                  {s}
                </span>
              ))}
              {(beat.ambiances ?? []).map((a: string) => (
                <span key={a} className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-500">
                  {a}
                </span>
              ))}
              {(beat.instruments ?? []).map((i: string) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-500">
                  {i}
                </span>
              ))}
            </div>
          )}

          {/* Bouton play */}
          <div className="mt-6">
            <BeatDetailPlayButton
              beat={{
                id: beat.id,
                titre: beat.titre,
                image_url: beat.image_url,
                mp3_tague_url: beat.mp3_tague_url,
              }}
            />
          </div>
        </div>
      </div>

      {/* Licences */}
      <LicencesTable licences={licences} />
    </div>
  )
}
