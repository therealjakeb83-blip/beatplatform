import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import BoutiqueHeader from './_components/BoutiqueHeader'
import BeatCatalogue from './_components/BeatCatalogue'
import SuccessBanner from './_components/SuccessBanner'
import type { BeatPublic, LicencePublic } from './_components/BeatCard'

export default async function BoutiquePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, slug, tagline, logo_url, instagram_url, youtube_url, tiktok_url')
    .eq('slug', slug)
    .single()

  if (!beatmaker) notFound()

  // Vérifier si le visiteur est abonné — session Supabase en priorité, cookie en fallback
  const { data: { user } } = await supabase.auth.getUser()
  let estAbonne = false

  if (user) {
    // Vérifier l'abonnement par client_id OU par email (rétrocompatibilité)
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .eq('statut', 'actif')
      .maybeSingle()
    estAbonne = !!abo
  }

  // Fallback cookie — pour les abonnés qui n'ont pas encore créé de compte
  if (!estAbonne) {
    const cookieStore = await cookies()
    const emailCookie = cookieStore.get(`abo_${slug}`)?.value
    if (emailCookie) {
      const { data: abo } = await admin
        .from('abonnements_boutique')
        .select('id')
        .eq('beatmaker_id', beatmaker.id)
        .eq('acheteur_email', emailCookie)
        .eq('statut', 'actif')
        .maybeSingle()
      estAbonne = !!abo
    }
  }

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

  // mp3_tague_url inclus uniquement pour les abonnés (sinon le player est bloqué côté client)
  const selectPrives = estAbonne
    ? `id, titre, bpm, cle, image_url, mp3_tague_url, free_download_actif, styles, ambiances, instruments, type_beat, beat_licences(actif, prix_override, sur_demande, licences(id, nom, modele, prix, actif))`
    : `id, titre, bpm, cle, image_url, free_download_actif, styles, ambiances, instruments, type_beat, beat_licences(actif, prix_override, sur_demande, licences(id, nom, modele, prix, actif))`

  const { data: rawBeatsPrives } = await supabase
    .from('beats')
    .select(selectPrives)
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
    free_download_actif: boolean
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
      free_download_actif: beat.free_download_actif,
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
      <Suspense>
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <SuccessBanner />
        </div>
      </Suspense>
      <BeatCatalogue
        beats={beats}
        beatsPrives={beatsPrives}
        slug={slug}
        estAbonne={estAbonne}
        clientId={user?.id ?? null}
      />
    </>
  )
}
