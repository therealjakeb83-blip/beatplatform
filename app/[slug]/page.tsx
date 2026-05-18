import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import BoutiqueHeader from './_components/BoutiqueHeader'
import BeatCatalogue from './_components/BeatCatalogue'
import type { BeatPublic, LicencePublic } from './_components/BeatCard'

export default async function BoutiquePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id, nom_artiste, slug, tagline, logo_url, instagram_url, youtube_url, tiktok_url')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  // Vérifier si le visiteur est abonné (cookie)
  const cookieStore = await cookies()
  const emailCookie = cookieStore.get(`abo_${slug}`)?.value
  let estAbonne = false
  if (emailCookie) {
    const admin = createAdminClient()
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .eq('acheteur_email', emailCookie)
      .eq('statut', 'actif')
      .single()
    estAbonne = !!abo
  }

  const now = new Date().toISOString()

  const { data: rawBeats } = await supabase
    .from('beats')
    .select(`
      id, titre, bpm, cle, image_url, mp3_tague_url,
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

  // mp3_tague_url volontairement exclu pour les beats privés (pas de streaming sans abonnement)
  const { data: rawBeatsPrives } = await supabase
    .from('beats')
    .select(`
      id, titre, bpm, cle, image_url,
      styles, ambiances, instruments, type_beat,
      beat_licences (
        actif, prix_override, sur_demande,
        licences (id, nom, modele, prix, actif)
      )
    `)
    .eq('beatmaker_id', beatmaker.id)
    .eq('statut', 'prive')
    .is('supprime_le', null)
    .order('created_at', { ascending: false })

  type RawBeat = {
    id: string
    titre: string
    bpm: number | null
    cle: string | null
    image_url: string | null
    mp3_tague_url: string | null
    styles: string[] | null
    ambiances: string[] | null
    instruments: string[] | null
    type_beat: string[] | null
    beat_licences: {
      actif: boolean
      prix_override: number | null
      sur_demande: boolean
      licences: {
        id: string
        nom: string
        modele: string
        prix: number
        actif: boolean
      } | null
    }[] | null
  }

  function mapBeat(beat: RawBeat, prive = false): BeatPublic {
    return {
      id: beat.id,
      titre: beat.titre,
      bpm: beat.bpm,
      cle: beat.cle,
      image_url: beat.image_url,
      mp3_tague_url: beat.mp3_tague_url,
      styles: beat.styles,
      ambiances: beat.ambiances,
      instruments: beat.instruments,
      type_beat: beat.type_beat,
      prive,
      licences: (beat.beat_licences ?? [])
        .filter(bl => bl.actif && bl.licences?.actif)
        .map((bl): LicencePublic => ({
          id: bl.licences!.id,
          nom: bl.licences!.nom,
          modele: bl.licences!.modele,
          prix: bl.prix_override ?? bl.licences!.prix,
          sur_demande: bl.sur_demande,
        })),
    }
  }

  const beats: BeatPublic[] = (rawBeats as unknown as RawBeat[] ?? []).map(b => mapBeat(b, false))
  const beatsPrives: BeatPublic[] = (rawBeatsPrives as unknown as RawBeat[] ?? []).map(b => mapBeat(b, true))

  return (
    <>
      <BoutiqueHeader
        nomArtiste={beatmaker.nom_artiste}
        tagline={beatmaker.tagline}
        logoUrl={beatmaker.logo_url}
        instagramUrl={beatmaker.instagram_url}
        youtubeUrl={beatmaker.youtube_url}
        tiktokUrl={beatmaker.tiktok_url}
        nbBeats={beats.length}
      />
      <BeatCatalogue beats={beats} beatsPrives={beatsPrives} slug={slug} estAbonne={estAbonne} />
    </>
  )
}
