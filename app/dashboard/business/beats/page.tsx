import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import BeatsClient from './_components/BeatsClient'

export type BeatRow = {
  id: string
  titre: string
  bpm: number | null
  cle: string | null
  statut: string
  image_url: string | null
  couleur: string | null
  created_at: string
  styles: string[] | null
  type_beat: string[] | null
  mp3_tague_url: string | null
  licences: string[]
}

type BeatFiles = {
  mp3_propre_url: string | null
  wav_url: string | null
  stems_url: string | null
}

type LicRow = { id: string; modele: string }
type BlRow  = { beat_id: string; licence_id: string; actif: boolean }

function licenceDisponible(modele: string, f: BeatFiles): boolean {
  switch (modele) {
    case 'mp3':       return !!f.mp3_propre_url
    case 'wav':       return !!f.mp3_propre_url && !!f.wav_url
    case 'stems':
    case 'illimite':
    case 'exclusive': return !!f.mp3_propre_url && !!f.wav_url && !!f.stems_url
    default:          return false
  }
}

export default async function BeatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: rawBeats } = await admin
    .from('beats')
    .select('id, titre, bpm, cle, statut, image_url, couleur, created_at, styles, type_beat, mp3_tague_url, mp3_propre_url, wav_url, stems_url')
    .eq('beatmaker_id', user.id)
    .is('supprime_le', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const beatIds = (rawBeats ?? []).map(b => b.id as string)
  if (beatIds.length === 0) return <BeatsClient beats={[]} />

  // Map beat_id → fichiers disponibles
  const beatFilesMap = new Map<string, BeatFiles>()
  for (const b of (rawBeats ?? [])) {
    beatFilesMap.set(b.id as string, {
      mp3_propre_url: (b as Record<string, unknown>).mp3_propre_url as string | null ?? null,
      wav_url:        (b as Record<string, unknown>).wav_url        as string | null ?? null,
      stems_url:      (b as Record<string, unknown>).stems_url      as string | null ?? null,
    })
  }

  const [{ data: blRows }, { data: licRows }] = await Promise.all([
    admin
      .from('beat_licences')
      .select('beat_id, licence_id, actif')
      .in('beat_id', beatIds),
    admin
      .from('licences')
      .select('id, modele')
      .eq('beatmaker_id', user.id)
      .eq('actif', true),
  ])

  // Map licence_id → modele
  const modeleMap = new Map<string, string>()
  for (const l of (licRows ?? []) as LicRow[]) modeleMap.set(l.id, l.modele)

  // Beats ayant au moins une entrée beat_licences
  const beatsConfigures = new Set<string>()
  for (const bl of (blRows ?? []) as BlRow[]) beatsConfigures.add(bl.beat_id)

  // ── Correction silencieuse ──────────────────────────────────────────────────
  // L'ancienne migration avait posé actif=true pour toutes les licences sans
  // vérifier les fichiers. On corrige : actif=true + fichier absent → actif=false.
  const correctionEntries: Array<{
    beat_id: string; licence_id: string; actif: false
    prix_override: null; sur_demande: boolean
  }> = []
  for (const bl of (blRows ?? []) as BlRow[]) {
    if (!bl.actif) continue
    const modele = modeleMap.get(bl.licence_id)
    if (!modele) continue
    const files = beatFilesMap.get(bl.beat_id)
    if (!files || !licenceDisponible(modele, files)) {
      correctionEntries.push({
        beat_id: bl.beat_id, licence_id: bl.licence_id,
        actif: false, prix_override: null, sur_demande: false,
      })
    }
  }
  if (correctionEntries.length > 0) {
    await admin.from('beat_licences').upsert(correctionEntries, { onConflict: 'beat_id,licence_id' })
  }
  // Clé composite → valeur corrigée, pour l'affichage immédiat sans second fetch
  const correctionMap = new Map<string, false>()
  for (const e of correctionEntries) correctionMap.set(`${e.beat_id}:${e.licence_id}`, false)
  // ───────────────────────────────────────────────────────────────────────────

  // ── Initialisation des beats sans configuration (file-based) ───────────────
  const beatsNonConfigures = beatIds.filter(id => !beatsConfigures.has(id))
  if (beatsNonConfigures.length > 0 && (licRows ?? []).length > 0) {
    const entries = beatsNonConfigures.flatMap(beatId => {
      const files = beatFilesMap.get(beatId) ?? { mp3_propre_url: null, wav_url: null, stems_url: null }
      return (licRows as LicRow[]).map(l => ({
        beat_id:       beatId,
        licence_id:    l.id,
        actif:         licenceDisponible(l.modele, files),
        prix_override: null,
        sur_demande:   false,
      }))
    })
    await admin.from('beat_licences').upsert(entries, { onConflict: 'beat_id,licence_id' })
    for (const id of beatsNonConfigures) beatsConfigures.add(id)
  }
  // ───────────────────────────────────────────────────────────────────────────

  // ── Construction de la map beat_id → licences actives ──────────────────────
  const licencesMap = new Map<string, string[]>()

  // Beats déjà configurés : lire blRows en appliquant les corrections mémoire
  for (const bl of (blRows ?? []) as BlRow[]) {
    const key = `${bl.beat_id}:${bl.licence_id}`
    const actif = correctionMap.has(key) ? false : bl.actif
    if (!actif) continue
    const modele = modeleMap.get(bl.licence_id)
    if (!modele) continue
    if (!licencesMap.has(bl.beat_id)) licencesMap.set(bl.beat_id, [])
    licencesMap.get(bl.beat_id)!.push(modele)
  }

  // Beats nouvellement initialisés : recalculer depuis les fichiers
  for (const id of beatsNonConfigures) {
    const files = beatFilesMap.get(id) ?? { mp3_propre_url: null, wav_url: null, stems_url: null }
    const modeles = (licRows as LicRow[]).filter(l => licenceDisponible(l.modele, files)).map(l => l.modele)
    if (modeles.length > 0) licencesMap.set(id, modeles)
  }
  // ───────────────────────────────────────────────────────────────────────────

  const beats: BeatRow[] = (rawBeats ?? []).map(b => ({
    id:            b.id as string,
    titre:         b.titre as string,
    bpm:           b.bpm as number | null,
    cle:           b.cle as string | null,
    statut:        b.statut as string,
    image_url:     b.image_url as string | null,
    couleur:       (b as Record<string, unknown>).couleur as string | null ?? null,
    created_at:    b.created_at as string,
    styles:        b.styles as string[] | null,
    type_beat:     b.type_beat as string[] | null,
    mp3_tague_url: b.mp3_tague_url as string | null,
    licences:      licencesMap.get(b.id as string) ?? [],
  }))

  return <BeatsClient beats={beats} />
}
