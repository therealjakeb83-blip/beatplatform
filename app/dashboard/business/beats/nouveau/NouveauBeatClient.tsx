'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BeatForm, { BeatFormValues, LicenceInfo } from '../_components/BeatForm'

export default function NouveauBeatClient({ beatId, licences }: { beatId: string; licences: LicenceInfo[] }) {
  const router = useRouter()

  const initialValues: BeatFormValues = {
    titre: '', bpm: '', note: '', mode: '', statut: 'prive',
    dateSortie: '', styles: [], ambiances: [], instruments: [],
    typeBeat: [], freeDownload: false, collaborateurs: [],
    licencesActives: licences.map(l => l.id),
    exclusifSurDemande: false,
    exclusifPrixOverride: '',
  }

  async function handleSubmit(values: BeatFormValues, urls: Record<string, string>) {
    const cle = values.note && values.mode ? `${values.note} ${values.mode}` : null
    const res = await fetch('/api/beats/creer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beatId, cle,
        titre: values.titre, bpm: values.bpm, statut: values.statut,
        date_sortie: values.dateSortie || null,
        styles: values.styles, ambiances: values.ambiances,
        instruments: values.instruments, type_beat: values.typeBeat,
        free_download_actif: values.freeDownload,
        collaborateurs: values.collaborateurs,
        licences_actives: values.licencesActives,
        exclusif_sur_demande: values.exclusifSurDemande,
        exclusif_prix_override: values.exclusifPrixOverride || null,
        ...urls,
      }),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error)
    router.push('/dashboard/business/beats')
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/dashboard/business/beats" className="text-gray-400 hover:text-white transition-colors text-sm">← Mes beats</Link>
          <h1 className="text-2xl font-bold">Ajouter un beat</h1>
        </div>
        <BeatForm beatId={beatId} initialValues={initialValues} licences={licences} submitLabel="Enregistrer le beat" onSubmit={handleSubmit} />
      </div>
    </main>
  )
}
