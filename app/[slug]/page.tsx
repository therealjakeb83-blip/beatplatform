import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Hero from './_components/Hero'
import BeatCatalogue from './_components/BeatCatalogue'
import SuccessBanner from './_components/SuccessBanner'
import CategorieBrowseSection from './_components/CategorieBrowseSection'
import type { BeatPublic, LicencePublic } from './_components/BeatCard'
import { agregerStatsParCategorie, statsPour } from '@/lib/categories-stats'
import type { TypeCategorieDb } from './_lib/categories-urls'

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
    .select('id, nom_artiste, slug, tagline, logo_url, instagram_url, youtube_url, tiktok_url, hero_titre, hero_sous_titre, abo_actif')
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
      id, titre, bpm, cle, image_url, mp3_tague_url, free_download_actif, mis_en_avant,
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
    ? `id, titre, bpm, cle, image_url, mp3_tague_url, free_download_actif, mis_en_avant, styles, ambiances, instruments, type_beat, beat_licences(actif, prix_override, sur_demande, licences(id, nom, modele, prix, actif))`
    : `id, titre, bpm, cle, image_url, free_download_actif, mis_en_avant, styles, ambiances, instruments, type_beat, beat_licences(actif, prix_override, sur_demande, licences(id, nom, modele, prix, actif))`

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
    mis_en_avant: boolean
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

  const rawBeatsArr = rawBeats as unknown as RawBeat[] ?? []
  const rawBeatsPrivesArr = rawBeatsPrives as unknown as RawBeat[] ?? []

  const beats: BeatPublic[] = rawBeatsArr.map(b => mapBeat(b, false))
  const beatsPrives: BeatPublic[] = rawBeatsPrivesArr.map(b => mapBeat(b, true))
  const selection: BeatPublic[] = [
    ...rawBeatsArr.filter(b => b.mis_en_avant).map(b => mapBeat(b, false)),
    ...rawBeatsPrivesArr.filter(b => b.mis_en_avant).map(b => mapBeat(b, true)),
  ]

  // Compteurs par tag (styles/ambiances/instruments/type beats) — uniquement
  // sur les beats publics, cohérent avec ce qu'un visiteur non-abonné peut
  // réellement parcourir sans compte.
  const statsParTag = agregerStatsParCategorie(rawBeatsArr, [], [])

  // Images des cartes catégories — best-effort : si la table `categories`
  // (Phase 7) n'existe pas encore en base, ces requêtes renvoient
  // simplement des tableaux vides et les cartes retombent sur l'avatar-initiales.
  const [{ data: categoriesRaw }, { data: overridesRaw }] = await Promise.all([
    admin
      .from('categories')
      .select('id, type, nom, image_url')
      .or(`source.eq.plateforme,beatmaker_id.eq.${beatmaker.id},statut.eq.certifiee`),
    admin
      .from('categories_images_boutique')
      .select('categorie_id, image_url')
      .eq('beatmaker_id', beatmaker.id),
  ])

  const overridesById = new Map(
    (overridesRaw ?? []).map(o => [o.categorie_id as string, o.image_url as string])
  )
  const imageParTag = new Map<string, string>()
  for (const c of (categoriesRaw ?? []) as { id: string; type: TypeCategorieDb; nom: string; image_url: string | null }[]) {
    const image = overridesById.get(c.id) ?? c.image_url
    if (image) imageParTag.set(`${c.type}|${c.nom}`, image)
  }

  function listePourType(type: TypeCategorieDb, get: (b: RawBeat) => string[] | null) {
    const noms = new Set<string>()
    rawBeatsArr.forEach(b => get(b)?.forEach(n => noms.add(n)))
    return [...noms]
      .map(nom => ({
        nom,
        count: statsPour(statsParTag, type, nom).nb_beats,
        imageUrl: imageParTag.get(`${type}|${nom}`) ?? null,
      }))
      .sort((a, b) => b.count - a.count)
  }

  const stylesCartes = listePourType('styles', b => b.styles)
  const ambiancesCartes = listePourType('ambiances', b => b.ambiances)
  const instrumentsCartes = listePourType('instruments', b => b.instruments)
  const typeBeatCartes = listePourType('type_beat', b => b.type_beat)

  return (
    <>
      <Hero
        slug={slug}
        nomArtiste={beatmaker.nom_artiste}
        heroTitre={beatmaker.hero_titre}
        heroSousTitre={beatmaker.hero_sous_titre}
        tagline={beatmaker.tagline}
        aboActif={beatmaker.abo_actif}
      />
      <Suspense>
        <div className="shop-container">
          <SuccessBanner />
        </div>
      </Suspense>
      <BeatCatalogue
        beats={beats}
        beatsPrives={beatsPrives}
        selection={selection}
        slug={slug}
        estAbonne={estAbonne}
        clientId={user?.id ?? null}
      />
      <div className="shop-container">
        <CategorieBrowseSection id="parcourir-styles" type="styles" slug={slug} cartes={stylesCartes} />
        <CategorieBrowseSection id="parcourir-type-beat" type="type_beat" slug={slug} cartes={typeBeatCartes} />
        <CategorieBrowseSection id="parcourir-instruments" type="instruments" slug={slug} cartes={instrumentsCartes} />
        <CategorieBrowseSection id="parcourir-ambiances" type="ambiances" slug={slug} cartes={ambiancesCartes} />
      </div>
    </>
  )
}
