'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BeatForm, { BeatFormValues, ExistingUrls, Collaborateur, CollaborationHistorique, LicenceInfo, CategoriesOptions } from '../../_components/BeatForm'

const STATUTS_OUVERTS = ['invitee', 'active', 'refusee']

export default function ModifierBeatClient({ beat, splits, licences, licencesActives, exclusifSurDemande, licenceOverrides, categories, lectureSeule = false }: {
  beat: Record<string, unknown>
  splits: Array<{
    id: string
    beatmaker_id: string | null
    email_invite: string | null
    pourcentage: number
    statut: string
    motif_eviction?: string | null
    beatmakers: { nom_artiste: string } | null
  }>
  licences: LicenceInfo[]
  licencesActives: string[]
  exclusifSurDemande: boolean
  licenceOverrides: Record<string, string>
  categories: CategoriesOptions
  lectureSeule?: boolean
}) {
  const router = useRouter()

  const [noteInit, modeInit] = beat.cle ? (beat.cle as string).split(' ') : ['', '']

  const initialValues: BeatFormValues = {
    titre: (beat.titre as string) ?? '',
    bpm: beat.bpm ? String(beat.bpm) : '',
    note: noteInit ?? '',
    mode: modeInit ?? '',
    statut: (beat.statut as string) ?? 'prive',
    dateSortie: beat.date_sortie ? (beat.date_sortie as string).slice(0, 10) : '',
    styles: (beat.styles as string[]) ?? [],
    ambiances: (beat.ambiances as string[]) ?? [],
    instruments: (beat.instruments as string[]) ?? [],
    typeBeat: (beat.type_beat as string[]) ?? [],
    freeDownload: (beat.free_download_actif as boolean) ?? false,
    // Seules les collaborations ENCORE OUVERTES entrent dans le tableau soumis
    // à l'enregistrement du beat — une collaboration terminée (retirée,
    // quittée, évincée) ne doit plus jamais y repasser, sinon elle serait
    // réinvitée silencieusement à chaque sauvegarde (traiterCollaborateursBeat
    // ne compare qu'aux statuts ouverts pour détecter les doublons). Voir
    // `historique` juste en dessous pour l'affichage en lecture seule.
    collaborateurs: splits.filter(s => STATUTS_OUVERTS.includes(s.statut)).map(s => ({
      id: s.id,
      type: s.beatmaker_id ? 'compte' : 'email',
      beatmaker_id: s.beatmaker_id ?? undefined,
      nom_artiste: s.beatmakers?.nom_artiste,
      email_invite: s.email_invite ?? undefined,
      pourcentage: s.pourcentage,
      statut: s.statut as Collaborateur['statut'],
    } as Collaborateur)),
    licencesActives,
    exclusifSurDemande,
    licenceOverrides,
  }

  const historiqueCollaborateurs: CollaborationHistorique[] = splits
    .filter(s => !STATUTS_OUVERTS.includes(s.statut))
    .map(s => ({
      id: s.id,
      nom: s.beatmakers?.nom_artiste ?? s.email_invite ?? 'Collaborateur',
      statut: s.statut as CollaborationHistorique['statut'],
      motif: s.motif_eviction ?? null,
      pourcentage: s.pourcentage,
    }))

  const existingUrls: ExistingUrls = {
    image_url: beat.image_url as string | null,
    mp3_tague_url: beat.mp3_tague_url as string | null,
    mp3_propre_url: beat.mp3_propre_url as string | null,
    wav_url: beat.wav_url as string | null,
    stems_url: beat.stems_url as string | null,
  }

  async function handleSubmit(values: BeatFormValues, urls: Record<string, string>) {
    const cle = values.note && values.mode ? `${values.note} ${values.mode}` : null
    const res = await fetch(`/api/beats/${beat.id}/modifier`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cle, titre: values.titre, bpm: values.bpm, statut: values.statut,
        date_sortie: values.dateSortie || null,
        styles: values.styles, ambiances: values.ambiances,
        instruments: values.instruments, type_beat: values.typeBeat,
        free_download_actif: values.freeDownload,
        collaborateurs: values.collaborateurs,
        licences_actives: values.licencesActives,
        exclusif_sur_demande: values.exclusifSurDemande,
        licence_overrides: values.licenceOverrides,
        ...urls,
      }),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error)
    router.push('/dashboard/business/beats')
  }

  async function handleDelete() {
    const res = await fetch(`/api/beats/${beat.id}/supprimer`, { method: 'DELETE' })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error)
    router.push('/dashboard/business/beats')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-10">
        <Link href="/dashboard/business/beats" className="text-gray-400 hover:text-white transition-colors text-sm">← Beats</Link>
        <h1 className="text-2xl font-bold">Modifier le beat</h1>
      </div>
      <BeatForm
        beatId={beat.id as string}
        initialValues={initialValues}
        existingUrls={existingUrls}
        licences={licences}
        categories={categories}
        submitLabel="Mettre à jour"
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        lectureSeule={lectureSeule}
        historiqueCollaborateurs={historiqueCollaborateurs}
      />
    </div>
  )
}
