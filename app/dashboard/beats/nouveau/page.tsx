'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MODES = ['majeur', 'mineur']

const TYPE_BEAT_OPTIONS = [
  'SCH', 'Werenoi', 'Zamdane', 'Tiakola', 'Gazo', 'SDM', 'Hamza', 'Niaks',
  'Makar', 'Ven1', 'Bouss', 'Ninho', 'Damso', 'Saïf', 'Timar',
  'Green Montana', 'Lacrim', 'Vacra', 'US Type Beat',
]

const STYLES_OPTIONS = [
  'Trap', 'Drill', 'UK Drill', 'Afro Trap', 'Afrobeat', 'R&B', 'Pop',
  'Boom Bap', 'Lo-Fi', 'Dancehall', 'Reggaeton', 'Cloud Rap', 'Pluggnb', 'Jersey Club',
]
const AMBIANCES_OPTIONS = [
  'Dark', 'Chill', 'Energetic', 'Mélancolique', 'Hype', 'Romantique',
  'Mystérieux', 'Épique', 'Festif', 'Introspectif',
]
const INSTRUMENTS_OPTIONS = [
  'Piano', 'Guitare', 'Cordes', '808', 'Flûte', 'Violon',
  'Basse', 'Synthé', 'Cuivres', 'Harpe', 'Orgue', 'Marimba',
]

function TagSelector({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag))
    } else {
      onChange([...selected, tag])
    }
  }

  return (
    <div>
      <label className="block text-sm text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selected.includes(tag)
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}

function HybridTagSelector({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag))
    } else {
      onChange([...selected, tag])
    }
  }

  function addCustom() {
    const val = input.trim()
    if (val && !selected.includes(val)) {
      onChange([...selected, val])
    }
    setInput('')
  }

  return (
    <div>
      <label className="block text-sm text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selected.includes(tag)
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
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
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
        >
          Ajouter
        </button>
      </div>
    </div>
  )
}

async function uploadImage(file: File, beatId: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('beatId', beatId)
  const res = await fetch('/api/upload/image', { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return data.url
}

async function uploadAudio(file: File, beatId: string, fileType: string): Promise<string> {
  const res = await fetch('/api/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beatId, fileType }),
  })
  const { uploadUrl, fileUrl } = await res.json()
  await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  return fileUrl
}

function FileInput({
  label,
  accept,
  required,
  file,
  onChange,
  hint,
}: {
  label: string
  accept: string
  required?: boolean
  file: File | null
  onChange: (f: File | null) => void
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1">
        {label} {required && <span className="text-indigo-400">*</span>}
        {!required && <span className="text-gray-500 text-xs ml-1">(optionnel)</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <div className="flex items-center gap-3">
        <label className="cursor-pointer px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors border border-gray-700">
          Choisir un fichier
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={e => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {file
          ? <span className="text-sm text-indigo-400 truncate max-w-xs">{file.name}</span>
          : <span className="text-sm text-gray-600">Aucun fichier</span>
        }
        {file && (
          <button type="button" onClick={() => onChange(null)} className="text-gray-500 hover:text-red-400 text-sm">✕</button>
        )}
      </div>
    </div>
  )
}

export default function NouveauBeatPage() {
  const router = useRouter()

  const [beatId] = useState(() => crypto.randomUUID())
  const [titre, setTitre] = useState('')
  const [bpm, setBpm] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState('')
  const [statut, setStatut] = useState('prive')
  const [dateSortie, setDateSortie] = useState('')
  const [styles, setStyles] = useState<string[]>([])
  const [ambiances, setAmbiances] = useState<string[]>([])
  const [instruments, setInstruments] = useState<string[]>([])
  const [typeBeat, setTypeBeat] = useState<string[]>([])
  const [freeDownload, setFreeDownload] = useState(false)
  const [useLogo, setUseLogo] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [mp3TagueFile, setMp3TagueFile] = useState<File | null>(null)
  const [mp3PropreFile, setMp3PropreFile] = useState<File | null>(null)
  const [wavFile, setWavFile] = useState<File | null>(null)
  const [stemsFile, setStemsFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur] = useState('')

  function handleCoverChange(file: File | null) {
    setCoverFile(file)
    if (file) {
      setCoverPreview(URL.createObjectURL(file))
      setUseLogo(false)
    } else {
      setCoverPreview(null)
    }
  }

  const peutEtrePublic = mp3TagueFile !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')

    if ((statut === 'public' || statut === 'programme') && !mp3TagueFile) {
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

      // Sauvegarde en BDD — étape 4.5
      console.log('Prêt à sauvegarder', { beatId, titre, urls })
    } catch {
      setErreur("Erreur lors de l'upload. Réessaie.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">

        <div className="flex items-center gap-4 mb-10">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Ajouter un beat</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">

          {/* Infos générales */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">
              Informations générales
            </h2>

            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Titre <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                value={titre}
                onChange={e => setTitre(e.target.value)}
                required
                placeholder="Ex : Midnight Drive"
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Statut</label>
                <select
                  value={statut}
                  onChange={e => setStatut(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="prive">Réservé aux membres</option>
                  <option value="public" disabled={!peutEtrePublic}>Public{!peutEtrePublic ? ' (MP3 taguée requise)' : ''}</option>
                  <option value="programme" disabled={!peutEtrePublic}>Programmé{!peutEtrePublic ? ' (MP3 taguée requise)' : ''}</option>
                  <option value="masque">Masqué</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Date de sortie</label>
                <input
                  type="date"
                  value={dateSortie}
                  onChange={e => setDateSortie(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </section>

          {/* Infos musicales */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">
              Infos musicales
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">BPM</label>
                <input
                  type="number"
                  value={bpm}
                  onChange={e => setBpm(e.target.value)}
                  min={40}
                  max={300}
                  placeholder="Ex : 140"
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Clé musicale</label>
                <div className="flex gap-2">
                  <select
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="flex-1 px-3 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Note</option>
                    {NOTES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <select
                    value={mode}
                    onChange={e => setMode(e.target.value)}
                    className="flex-1 px-3 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Mode</option>
                    {MODES.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Tags */}
          <section className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">
              Tags
            </h2>
            <HybridTagSelector
              label="Styles"
              options={STYLES_OPTIONS}
              selected={styles}
              onChange={setStyles}
              placeholder="Ajouter un style..."
            />
            <TagSelector
              label="Ambiances"
              options={AMBIANCES_OPTIONS}
              selected={ambiances}
              onChange={setAmbiances}
            />
            <TagSelector
              label="Instruments"
              options={INSTRUMENTS_OPTIONS}
              selected={instruments}
              onChange={setInstruments}
            />
            <HybridTagSelector
              label="Type Beat"
              options={TYPE_BEAT_OPTIONS}
              selected={typeBeat}
              onChange={setTypeBeat}
              placeholder="Ajouter un artiste..."
            />
          </section>

          {/* Options */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">
              Options
            </h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setFreeDownload(!freeDownload)}
                className={`w-11 h-6 rounded-full transition-colors ${freeDownload ? 'bg-indigo-600' : 'bg-gray-700'} relative`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${freeDownload ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-300">Free download actif</span>
            </label>
          </section>

          {/* Fichiers */}
          <section className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">
              Fichiers
            </h2>

            {/* Cover */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Cover <span className="text-indigo-400">*</span>
              </label>
              <div className="flex items-start gap-4">
                {coverPreview && (
                  <img src={coverPreview} alt="preview" className="w-20 h-20 rounded-lg object-cover" />
                )}
                <div className="flex flex-col gap-2 flex-1">
                  {!useLogo && (
                    <FileInput
                      label=""
                      accept="image/jpeg,image/png,image/webp"
                      file={coverFile}
                      onChange={handleCoverChange}
                      hint="JPG, PNG ou WebP — sera converti en WebP automatiquement"
                    />
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useLogo}
                      onChange={e => { setUseLogo(e.target.checked); if (e.target.checked) handleCoverChange(null) }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-400">Utiliser mon logo comme cover</span>
                  </label>
                </div>
              </div>
            </div>

            <FileInput
              label="MP3 Taguée"
              accept="audio/mpeg"
              required
              file={mp3TagueFile}
              onChange={setMp3TagueFile}
              hint="Requis pour publier le beat"
            />
            <FileInput
              label="MP3 Propre"
              accept="audio/mpeg"
              file={mp3PropreFile}
              onChange={setMp3PropreFile}
            />
            <FileInput
              label="WAV"
              accept="audio/wav,audio/x-wav"
              file={wavFile}
              onChange={setWavFile}
            />
            <FileInput
              label="Stems ZIP"
              accept=".zip,application/zip"
              file={stemsFile}
              onChange={setStemsFile}
            />
          </section>

          {erreur && <p className="text-red-400 text-sm">{erreur}</p>}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {uploading ? 'Upload en cours...' : 'Enregistrer le beat'}
            </button>
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-colors"
            >
              Annuler
            </Link>
          </div>

        </form>
      </div>
    </main>
  )
}
