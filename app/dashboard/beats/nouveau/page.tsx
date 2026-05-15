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

export default function NouveauBeatPage() {
  const router = useRouter()

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Sauvegarde en BDD — étape 4.5
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
                  <option value="public">Public</option>
                  <option value="programme">Programmé</option>
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

          {/* Fichiers — étape 4.4 */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-2">
              Fichiers
            </h2>
            <p className="text-sm text-gray-500 italic">Upload des fichiers audio — disponible à l&apos;étape suivante.</p>
          </section>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              Enregistrer le beat
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
