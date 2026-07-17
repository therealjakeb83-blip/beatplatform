'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const MODES = ['majeur', 'mineur']

// Options des tags — désormais chargées depuis la table `categories` (Phase
// 7) plutôt que codées en dur, pour permettre l'ajout libre + certification
// sur Styles/Type beat. Voir CategoriesOptions plus bas et
// app/dashboard/business/categories/.
export type CategoriesOptions = {
  styles: string[]
  ambiances: string[]
  instruments: string[]
  typeBeat: string[]
}

export type Collaborateur = {
  id: string
  type: 'compte' | 'email'
  beatmaker_id?: string
  nom_artiste?: string
  email_invite?: string
  pourcentage: number
}

export type BeatFormValues = {
  titre: string
  bpm: string
  note: string
  mode: string
  statut: string
  dateSortie: string
  styles: string[]
  ambiances: string[]
  instruments: string[]
  typeBeat: string[]
  freeDownload: boolean
  collaborateurs: Collaborateur[]
  licencesActives: string[]
  exclusifSurDemande: boolean
  exclusifPrixOverride: string
}

export type ExistingUrls = {
  image_url?: string | null
  mp3_tague_url?: string | null
  mp3_propre_url?: string | null
  wav_url?: string | null
  stems_url?: string | null
}

export type LicenceInfo = {
  id: string
  nom: string
  prix: number
  modele: string
  inclut_mp3: boolean
  inclut_wav: boolean
  inclut_stems: boolean
  est_exclusive: boolean
  streams_limite: number | null
}

function TagSelector({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void
}) {
  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(tag => (
          <button key={tag} type="button" onClick={() => toggle(tag)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selected.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}

function HybridTagSelector({ label, options, selected, onChange, placeholder }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
  const [input, setInput] = useState('')
  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }
  function addCustom() {
    const val = input.trim()
    if (val && !selected.includes(val)) onChange([...selected, val])
    setInput('')
  }
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map(tag => (
          <button key={tag} type="button" onClick={() => toggle(tag)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selected.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {tag}
          </button>
        ))}
      </div>
      {selected.filter(t => !options.includes(t)).map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-indigo-600 text-white mr-2 mb-2">
          {tag}
          <button type="button" onClick={() => toggle(tag)} className="ml-1 hover:text-indigo-200">×</button>
        </span>
      ))}
      <div className="flex gap-2 mt-1">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm" />
        <button type="button" onClick={addCustom}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">
          Ajouter
        </button>
      </div>
    </div>
  )
}

function CollaborateursSection({ collaborateurs, onChange }: {
  collaborateurs: Collaborateur[]; onChange: (v: Collaborateur[]) => void
}) {
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState<{ id: string; nom_artiste: string }[]>([])
  const [emailInvite, setEmailInvite] = useState('')
  const [pourcentage, setPourcentage] = useState('50')
  const [mode, setMode] = useState<'recherche' | 'email'>('recherche')
  const restant = 100 - collaborateurs.reduce((sum, c) => sum + c.pourcentage, 0)

  async function rechercherBeatmaker(q: string) {
    setRecherche(q)
    if (q.length < 2) { setResultats([]); return }
    const res = await fetch(`/api/beatmakers/recherche?q=${encodeURIComponent(q)}`)
    setResultats(await res.json())
  }
  function ajouterCompte(bm: { id: string; nom_artiste: string }) {
    const pct = parseInt(pourcentage)
    if (!pct || pct <= 0 || pct >= restant || collaborateurs.find(c => c.beatmaker_id === bm.id)) return
    onChange([...collaborateurs, { id: crypto.randomUUID(), type: 'compte', beatmaker_id: bm.id, nom_artiste: bm.nom_artiste, pourcentage: pct }])
    setRecherche(''); setResultats([])
  }
  function ajouterEmail() {
    const pct = parseInt(pourcentage)
    if (!emailInvite || !pct || pct <= 0 || pct >= restant || collaborateurs.find(c => c.email_invite === emailInvite)) return
    onChange([...collaborateurs, { id: crypto.randomUUID(), type: 'email', email_invite: emailInvite, pourcentage: pct }])
    setEmailInvite('')
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm text-gray-300">Collaborateurs</label>
        <span className={`text-xs font-medium ${restant < 0 ? 'text-red-400' : 'text-gray-400'}`}>Ton share : {restant}%</span>
      </div>
      {collaborateurs.length > 0 && (
        <div className="flex flex-col gap-2">
          {collaborateurs.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-lg">
              <div>
                <span className="text-sm text-white font-medium">{c.type === 'compte' ? c.nom_artiste : c.email_invite}</span>
                {c.type === 'email' && <span className="ml-2 text-xs text-yellow-400">invitation en attente</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-indigo-400 text-sm font-semibold">{c.pourcentage}%</span>
                <button type="button" onClick={() => onChange(collaborateurs.filter(x => x.id !== c.id))} className="text-gray-500 hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mb-1">
        {(['recherche', 'email'] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${mode === m ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            {m === 'recherche' ? 'Compte My Producer' : 'Inviter par email'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {mode === 'recherche' ? (
          <div className="flex-1 relative">
            <input type="text" value={recherche} onChange={e => rechercherBeatmaker(e.target.value)}
              placeholder="Rechercher un beatmaker..."
              className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm" />
            {resultats.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-10">
                {resultats.map(r => (
                  <button key={r.id} type="button" onClick={() => ajouterCompte(r)}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors">
                    {r.nom_artiste}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <input type="email" value={emailInvite} onChange={e => setEmailInvite(e.target.value)}
            placeholder="email@exemple.com"
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm" />
        )}
        <input type="number" value={pourcentage} onChange={e => setPourcentage(e.target.value)}
          min={1} max={restant}
          className="w-20 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm text-center" placeholder="%" />
        <button type="button" onClick={mode === 'recherche' ? () => resultats.length === 1 && ajouterCompte(resultats[0]) : ajouterEmail}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">
          Ajouter
        </button>
      </div>
    </div>
  )
}

export function FileInput({ label, accept, required, file, existingUrl, onChange, hint }: {
  label: string; accept: string; required?: boolean; file: File | null
  existingUrl?: string | null; onChange: (f: File | null) => void; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1">
        {label} {required && <span className="text-indigo-400">*</span>}
        {!required && <span className="text-gray-500 text-xs ml-1">(optionnel)</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      {existingUrl && !file && <p className="text-xs text-green-400 mb-2">✓ Fichier existant — choisir un nouveau pour remplacer</p>}
      <div className="flex items-center gap-3">
        <label className="cursor-pointer px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors border border-gray-700">
          Choisir un fichier
          <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] ?? null)} />
        </label>
        {file
          ? <span className="text-sm text-indigo-400 truncate max-w-xs">{file.name}</span>
          : <span className="text-sm text-gray-600">Aucun fichier</span>
        }
        {file && <button type="button" onClick={() => onChange(null)} className="text-gray-500 hover:text-red-400 text-sm">✕</button>}
      </div>
    </div>
  )
}

export async function uploadImage(file: File, beatId: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('beatId', beatId)
  const res = await fetch('/api/upload/image', { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return data.url
}

export async function uploadAudio(file: File, beatId: string, fileType: string): Promise<string> {
  const res = await fetch('/api/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beatId, fileType }),
  })
  const { uploadUrl, fileUrl } = await res.json()
  await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  return fileUrl
}

const MODELE_BADGES: Record<string, string[]> = {
  mp3:      ['MP3'],
  wav:      ['MP3', 'WAV'],
  stems:    ['MP3', 'WAV', 'Stems'],
  illimite: ['MP3', 'WAV', 'Stems', 'Illimité'],
  exclusive:['MP3', 'WAV', 'Stems', 'Exclusive'],
}

export default function BeatForm({
  beatId,
  initialValues,
  existingUrls = {},
  licences = [],
  categories,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  beatId: string
  initialValues: BeatFormValues
  existingUrls?: ExistingUrls
  licences?: LicenceInfo[]
  categories: CategoriesOptions
  submitLabel: string
  onSubmit: (values: BeatFormValues, urls: Record<string, string>) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [titre, setTitre] = useState(initialValues.titre)
  const [bpm, setBpm] = useState(initialValues.bpm)
  const [note, setNote] = useState(initialValues.note)
  const [mode, setMode] = useState(initialValues.mode)
  const [statut, setStatut] = useState(initialValues.statut)
  const [dateSortie, setDateSortie] = useState(initialValues.dateSortie)
  const [styles, setStyles] = useState(initialValues.styles)
  const [ambiances, setAmbiances] = useState(initialValues.ambiances)
  const [instruments, setInstruments] = useState(initialValues.instruments)
  const [typeBeat, setTypeBeat] = useState(initialValues.typeBeat)
  const [freeDownload, setFreeDownload] = useState(initialValues.freeDownload)
  const [collaborateurs, setCollaborateurs] = useState(initialValues.collaborateurs)
  const [licencesActives, setLicencesActives] = useState<string[]>(initialValues.licencesActives)
  const [exclusifSurDemande, setExclusifSurDemande] = useState(initialValues.exclusifSurDemande)
  const [exclusifPrixOverride, setExclusifPrixOverride] = useState(initialValues.exclusifPrixOverride)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(existingUrls.image_url ?? null)
  const [useLogo, setUseLogo] = useState(false)
  const [mp3TagueFile, setMp3TagueFile] = useState<File | null>(null)
  const [mp3PropreFile, setMp3PropreFile] = useState<File | null>(null)

  const [wavFile, setWavFile] = useState<File | null>(null)
  const [stemsFile, setStemsFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [erreur, setErreur] = useState('')

  const peutEtrePublic = !!mp3TagueFile || !!existingUrls.mp3_tague_url

  const hasMp3Propre = !!mp3PropreFile || !!existingUrls.mp3_propre_url
  const hasWav       = !!wavFile       || !!existingUrls.wav_url
  const hasStems     = !!stemsFile     || !!existingUrls.stems_url

  function licenceDisponible(modele: string): boolean {
    switch (modele) {
      case 'mp3':      return hasMp3Propre
      case 'wav':      return hasMp3Propre && hasWav
      case 'stems':
      case 'illimite':
      case 'exclusive': return hasMp3Propre && hasWav && hasStems
      default:          return true
    }
  }

  function fichierManquant(modele: string): string {
    if (modele === 'mp3' && !hasMp3Propre) return 'MP3 propre requis'
    if ((modele === 'wav') && !hasMp3Propre) return 'MP3 propre requis'
    if ((modele === 'wav') && !hasWav) return 'WAV requis'
    if (['stems', 'illimite', 'exclusive'].includes(modele)) {
      if (!hasMp3Propre) return 'MP3 propre requis'
      if (!hasWav) return 'WAV requis'
      if (!hasStems) return 'Stems requis'
    }
    return ''
  }

  useEffect(() => {
    setLicencesActives(prev =>
      prev.filter(id => {
        const l = licences.find(x => x.id === id)
        return l ? licenceDisponible(l.modele) : false
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMp3Propre, hasWav, hasStems])

  function handleCoverChange(file: File | null) {
    setCoverFile(file)
    setCoverPreview(file ? URL.createObjectURL(file) : (existingUrls.image_url ?? null))
    if (file) setUseLogo(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    if ((statut === 'public' || statut === 'programme') && !peutEtrePublic) {
      setErreur('Le MP3 taguée est requis pour publier ce beat.')
      return
    }
    setUploading(true)
    try {
      const urls: Record<string, string> = {}
      if (coverFile) urls.image_url = await uploadImage(coverFile, beatId)
      if (mp3TagueFile) urls.mp3_tague_url = await uploadAudio(mp3TagueFile, beatId, 'mp3_tague')
      if (mp3PropreFile) urls.mp3_propre_url = await uploadAudio(mp3PropreFile, beatId, 'mp3_propre')
      if (wavFile) urls.wav_url = await uploadAudio(wavFile, beatId, 'wav')
      if (stemsFile) urls.stems_url = await uploadAudio(stemsFile, beatId, 'stems')
      await onSubmit({ titre, bpm, note, mode, statut, dateSortie, styles, ambiances, instruments, typeBeat, freeDownload, collaborateurs, licencesActives, exclusifSurDemande, exclusifPrixOverride }, urls)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setUploading(true)
    try { await onDelete() } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">

      {/* Infos générales */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">Informations générales</h2>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Titre <span className="text-indigo-400">*</span></label>
          <input type="text" value={titre} onChange={e => setTitre(e.target.value)} required placeholder="Ex : Midnight Drive"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Statut</label>
            <select value={statut} onChange={e => setStatut(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500">
              <option value="prive">Réservé aux membres</option>
              <option value="public" disabled={!peutEtrePublic}>Public{!peutEtrePublic ? ' (MP3 taguée requise)' : ''}</option>
              <option value="programme" disabled={!peutEtrePublic}>Programmé{!peutEtrePublic ? ' (MP3 taguée requise)' : ''}</option>
              <option value="masque">Masqué</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Date de sortie</label>
            <input type="date" value={dateSortie} onChange={e => setDateSortie(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
      </section>

      {/* Infos musicales */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">Infos musicales</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">BPM</label>
            <input type="number" value={bpm} onChange={e => setBpm(e.target.value)} min={40} max={300} placeholder="Ex : 140"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Clé musicale</label>
            <div className="flex gap-2">
              <select value={note} onChange={e => setNote(e.target.value)}
                className="flex-1 px-3 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500">
                <option value="">Note</option>
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={mode} onChange={e => setMode(e.target.value)}
                className="flex-1 px-3 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500">
                <option value="">Mode</option>
                {MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Tags */}
      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">Tags</h2>
        <HybridTagSelector label="Styles" options={categories.styles} selected={styles} onChange={setStyles} placeholder="Ajouter un style..." />
        <TagSelector label="Ambiances" options={categories.ambiances} selected={ambiances} onChange={setAmbiances} />
        <TagSelector label="Instruments" options={categories.instruments} selected={instruments} onChange={setInstruments} />
        <HybridTagSelector label="Type Beat" options={categories.typeBeat} selected={typeBeat} onChange={setTypeBeat} placeholder="Ajouter un artiste..." />
        <p className="text-xs text-gray-500 -mt-2">
          Styles et Type Beat personnalisés : gérables (renommer, demander la certification) sur{' '}
          <Link href="/dashboard/business/categories" className="text-indigo-400 hover:underline">la page Catégories</Link>.
        </p>
      </section>

      {/* Collaborateurs */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">Collaborateurs</h2>
        <CollaborateursSection collaborateurs={collaborateurs} onChange={setCollaborateurs} />
      </section>

      {/* Options */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">Options</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div onClick={() => setFreeDownload(!freeDownload)}
            className={`w-11 h-6 rounded-full transition-colors ${freeDownload ? 'bg-indigo-600' : 'bg-gray-700'} relative`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${freeDownload ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-gray-300">Free download actif</span>
        </label>
      </section>

      {/* Licences */}
      {licences.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">Licences disponibles</h2>
          <div className="flex flex-col gap-2">
            {licences.map(licence => {
              const isActive = licencesActives.includes(licence.id)
              const isExclusive = licence.modele === 'exclusive'
              const disponible = licenceDisponible(licence.modele)
              const manquant = fichierManquant(licence.modele)
              return (
                <div key={licence.id} className={`bg-gray-800 rounded-lg overflow-hidden ${!disponible ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-white">{licence.nom}</span>
                      {!isExclusive && <span className="text-indigo-400 text-sm ml-2">{licence.prix}€</span>}
                      <span className="text-gray-500 text-xs ml-2">{MODELE_BADGES[licence.modele]?.join(' + ')}</span>
                      {!disponible && <span className="text-xs text-yellow-500 ml-2">⚠ {manquant}</span>}
                    </div>
                    <div
                      onClick={() => {
                        if (!disponible) return
                        setLicencesActives(isActive
                          ? licencesActives.filter(id => id !== licence.id)
                          : [...licencesActives, licence.id]
                        )
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${disponible ? 'cursor-pointer' : 'cursor-not-allowed'} ${isActive && disponible ? 'bg-indigo-600' : 'bg-gray-700'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isActive && disponible ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </div>

                  {isExclusive && isActive && (
                    <div className="border-t border-gray-700 px-4 py-3 flex flex-col gap-3">
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setExclusifSurDemande(false)}
                          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${!exclusifSurDemande ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                          Prix fixe
                        </button>
                        <button type="button" onClick={() => setExclusifSurDemande(true)}
                          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${exclusifSurDemande ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                          Sur demande
                        </button>
                      </div>
                      {!exclusifSurDemande && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={exclusifPrixOverride}
                            onChange={e => setExclusifPrixOverride(e.target.value)}
                            placeholder={`Prix global : ${licence.prix}€`}
                            min={1}
                            className="w-40 px-3 py-2 rounded-lg bg-gray-900 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                          />
                          <span className="text-gray-400 text-sm">€ <span className="text-gray-600">(vide = prix global)</span></span>
                        </div>
                      )}
                      {exclusifSurDemande && (
                        <p className="text-xs text-gray-400">Un bouton &quot;Me contacter&quot; sera affiché à la place du prix sur ta boutique.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Fichiers */}
      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">Fichiers</h2>
        <div>
          <label className="block text-sm text-gray-300 mb-2">Cover <span className="text-indigo-400">*</span></label>
          <div className="flex items-start gap-4">
            {coverPreview && <img src={coverPreview} alt="preview" className="w-20 h-20 rounded-lg object-cover" />}
            <div className="flex flex-col gap-2 flex-1">
              {!useLogo && (
                <FileInput label="" accept="image/jpeg,image/png,image/webp" file={coverFile}
                  existingUrl={existingUrls.image_url} onChange={handleCoverChange}
                  hint="JPG, PNG ou WebP — sera converti en WebP automatiquement" />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useLogo}
                  onChange={e => { setUseLogo(e.target.checked); if (e.target.checked) handleCoverChange(null) }}
                  className="rounded" />
                <span className="text-sm text-gray-400">Utiliser mon logo comme cover</span>
              </label>
            </div>
          </div>
        </div>
        <FileInput label="MP3 Taguée" accept="audio/mpeg" required file={mp3TagueFile}
          existingUrl={existingUrls.mp3_tague_url} onChange={setMp3TagueFile} hint="Requis pour publier le beat" />
        <FileInput label="MP3 Propre" accept="audio/mpeg" file={mp3PropreFile}
          existingUrl={existingUrls.mp3_propre_url} onChange={setMp3PropreFile} />
        <FileInput label="WAV" accept="audio/wav,audio/x-wav" file={wavFile}
          existingUrl={existingUrls.wav_url} onChange={setWavFile} />
        <FileInput label="Stems ZIP" accept=".zip,application/zip" file={stemsFile}
          existingUrl={existingUrls.stems_url} onChange={setStemsFile} />
      </section>

      {erreur && <p className="text-red-400 text-sm">{erreur}</p>}

      <div className="flex gap-4 pt-4">
        <button type="submit" disabled={uploading}
          className="flex-1 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50">
          {uploading ? 'En cours...' : submitLabel}
        </button>
        <Link href="/dashboard/business/beats"
          className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-colors">
          Annuler
        </Link>
      </div>

      {onDelete && (
        <div className="border-t border-gray-800 pt-6">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-500 hover:text-red-400 transition-colors">
              Supprimer ce beat
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-sm text-red-400">Confirmer la suppression ?</p>
              <button type="button" onClick={handleDelete} disabled={uploading}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                Supprimer
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors">
                Annuler
              </button>
            </div>
          )}
        </div>
      )}

    </form>
  )
}
