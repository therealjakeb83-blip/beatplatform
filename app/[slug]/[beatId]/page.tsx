import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import SuccessBanner from '../_components/SuccessBanner'
import FreeDLButton from '../_components/FreeDLButton'
import ProduitCard from './_components/ProduitCard'
import MemeStyleSection from './_components/MemeStyleSection'
import { estClientAbonne } from '../_lib/abonnement'
import type { LicencePublic, BeatPublic } from '../_components/BeatCard'

export default async function BeatDetailPage({
  params,
}: {
  params: Promise<{ slug: string; beatId: string }>
}) {
  const { slug, beatId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, slug, abo_actif, abo_remise_pct, tva_active, tva_taux')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  const { data: beat } = await supabase
    .from('beats')
    .select(`
      id, titre, bpm, cle, date_sortie, created_at, image_url, mp3_tague_url, statut, free_download_actif,
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
    .in('statut', ['public', 'prive'])
    .is('supprime_le', null)
    .single()

  if (!beat) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const estAbonne = await estClientAbonne({
    admin, beatmakerId: beatmaker.id, aboActif: beatmaker.abo_actif, slug, user,
  })

  if (beat.statut === 'prive' && !estAbonne) redirect(`/${slug}/membres`)

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

  const licences = ((beat.beat_licences ?? []) as unknown as RawBeatLicence[])
    .filter(bl => bl.actif && bl.licences?.actif)
    .map(bl => ({
      ...(bl.licences!),
      prix: bl.prix_override ?? bl.licences!.prix,
      sur_demande: bl.sur_demande,
    } satisfies LicencePublic))

  const tagPrincipal = beat.styles?.[0] ?? beat.type_beat?.[0] ?? null
  const tagPrincipalType: 'styles' | 'type-beat' = beat.styles?.[0] ? 'styles' : 'type-beat'

  // Icônes instruments — mêmes catégories (plateforme/certifiées/propres au
  // beatmaker) que le rail "Parcourir les instruments" de la home.
  const { data: categoriesInstruments } = await admin
    .from('categories')
    .select('nom, image_url')
    .eq('type', 'instruments')
    .or(`source.eq.plateforme,beatmaker_id.eq.${beatmaker.id},statut.eq.certifiee`)
  const iconeParInstrument = new Map(
    (categoriesInstruments ?? []).map(c => [c.nom, c.image_url as string | null])
  )
  const instruments = ((beat.instruments ?? []) as string[]).map(nom => ({
    nom,
    icone: iconeParInstrument.get(nom) ?? null,
  }))

  // Crédits "ft." — collaborateurs du beat avec un compte beatmaker existant
  // (une invitation en attente par email n'a pas de nom public à afficher).
  const { data: splitsData } = await admin
    .from('beat_splits')
    .select('beatmaker_id, beatmakers(nom_artiste)')
    .eq('beat_id', beatId)
    .not('beatmaker_id', 'is', null)
  const featuring = ((splitsData ?? []) as unknown as { beatmakers: { nom_artiste: string } | null }[])
    .map(s => s.beatmakers?.nom_artiste)
    .filter((n): n is string => !!n)
  const credits = featuring.length ? `${beatmaker.nom_artiste} ft. ${featuring.join(', ')}` : beatmaker.nom_artiste

  // Beats similaires — même style/type beat principal, même boutique,
  // complété par les plus récents si pas assez de correspondances.
  const { data: candidatsRaw } = await supabase
    .from('beats')
    .select(`
      id, titre, bpm, cle, image_url, mp3_tague_url, free_download_actif,
      styles, ambiances, instruments, type_beat,
      beat_licences (
        actif, prix_override, sur_demande,
        licences (
          id, nom, modele, prix, actif,
          inclut_mp3, inclut_wav, inclut_stems,
          streams_limite, vues_video_limite, clips_video_limite, est_exclusive
        )
      )
    `)
    .eq('beatmaker_id', beatmaker.id)
    .eq('statut', 'public')
    .neq('id', beatId)
    .is('supprime_le', null)
    .order('created_at', { ascending: false })
    .limit(40)

  type RawCandidat = {
    id: string
    titre: string
    bpm: number | null
    cle: string | null
    image_url: string | null
    mp3_tague_url: string | null
    free_download_actif: boolean
    styles: string[] | null
    ambiances: string[] | null
    instruments: string[] | null
    type_beat: string[] | null
    beat_licences: RawBeatLicence[] | null
  }

  function mapCandidat(b: RawCandidat): BeatPublic {
    return {
      id: b.id,
      titre: b.titre,
      bpm: b.bpm,
      cle: b.cle,
      image_url: b.image_url,
      mp3_tague_url: b.mp3_tague_url,
      free_download_actif: b.free_download_actif,
      tag: b.styles?.[0] ?? b.type_beat?.[0] ?? null,
      styles: b.styles,
      ambiances: b.ambiances,
      instruments: b.instruments,
      type_beat: b.type_beat,
      licences: (b.beat_licences ?? [])
        .filter(bl => bl.actif && bl.licences?.actif)
        .map((bl): LicencePublic => ({
          id: bl.licences!.id,
          nom: bl.licences!.nom,
          modele: bl.licences!.modele,
          prix: bl.prix_override ?? bl.licences!.prix,
          sur_demande: bl.sur_demande,
          est_exclusive: bl.licences!.est_exclusive,
          inclut_mp3: bl.licences!.inclut_mp3,
          inclut_wav: bl.licences!.inclut_wav,
          inclut_stems: bl.licences!.inclut_stems,
          streams_limite: bl.licences!.streams_limite,
          vues_video_limite: bl.licences!.vues_video_limite,
          clips_video_limite: bl.licences!.clips_video_limite,
        })),
    }
  }

  const candidats = ((candidatsRaw ?? []) as unknown as RawCandidat[]).map(mapCandidat)
  const memeStyle = tagPrincipal
    ? candidats.filter(b => b.styles?.includes(tagPrincipal) || b.type_beat?.includes(tagPrincipal))
    : []
  const complement = candidats.filter(b => !memeStyle.some(m => m.id === b.id))
  const similaires = [...memeStyle, ...complement].slice(0, 8)

  const dateAffichee = new Date(beat.date_sortie ?? beat.created_at).toLocaleDateString('fr-FR')

  const beatPourCarte: BeatPublic = {
    id: beat.id,
    titre: beat.titre,
    bpm: beat.bpm,
    cle: beat.cle,
    image_url: beat.image_url,
    mp3_tague_url: beat.mp3_tague_url,
    free_download_actif: beat.free_download_actif,
    tag: tagPrincipal,
    styles: beat.styles,
    ambiances: beat.ambiances,
    instruments: beat.instruments,
    type_beat: beat.type_beat,
    licences,
  }

  return (
    <div className="shop-container">
      <Suspense>
        <SuccessBanner />
      </Suspense>

      <ProduitCard
        slug={slug}
        beat={beatPourCarte}
        credits={credits}
        moods={beat.ambiances ?? []}
        instruments={instruments}
        dateAffichee={dateAffichee}
        clientId={user?.id ?? null}
        estAbonne={estAbonne}
        remisePct={beatmaker.abo_remise_pct ?? 0}
        tvaActive={beatmaker.tva_active ?? false}
        tvaTaux={beatmaker.tva_taux ?? null}
        queue={[beatPourCarte, ...similaires]}
      />

      {beat.free_download_actif && beat.mp3_tague_url && (
        <div className="shop-product-freedl">
          <div>
            <p className="shop-product-freedl-title">Téléchargement gratuit disponible</p>
            <p className="shop-product-freedl-sub">Usage personnel uniquement — non commercial</p>
          </div>
          <FreeDLButton
            beatId={beatId}
            beatTitre={beat.titre}
            slug={slug}
            clientId={user?.id ?? null}
          />
        </div>
      )}

      <MemeStyleSection
        slug={slug}
        beats={similaires}
        estAbonne={estAbonne}
        toutVoirHref={tagPrincipal ? `/${slug}/parcourir/${tagPrincipalType}/${encodeURIComponent(tagPrincipal)}` : null}
      />
    </div>
  )
}
