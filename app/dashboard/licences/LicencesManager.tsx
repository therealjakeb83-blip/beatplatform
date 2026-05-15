'use client'

import { useState } from 'react'
import Link from 'next/link'

type Licence = {
  id: string
  nom: string
  prix: number
  modele: string
  actif: boolean
  inclut_mp3: boolean
  inclut_wav: boolean
  inclut_stems: boolean
  est_exclusive: boolean
  streams_limite: number | null
}

const MODELE_BADGES: Record<string, string[]> = {
  mp3:      ['MP3'],
  wav:      ['MP3', 'WAV'],
  stems:    ['MP3', 'WAV', 'Stems'],
  illimite: ['MP3', 'WAV', 'Stems', 'Illimité'],
  exclusive:['MP3', 'WAV', 'Stems', 'Exclusive'],
}

export default function LicencesManager({ licences: initial }: { licences: Licence[] }) {
  const [licences, setLicences] = useState(initial)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nom: '', prix: '', streams_limite: '' })
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  async function patch(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/licences/${id}/modifier`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error)
  }

  async function toggleActif(licence: Licence) {
    const newActif = !licence.actif
    setLicences(l => l.map(x => x.id === licence.id ? { ...x, actif: newActif } : x))
    try {
      await patch(licence.id, { nom: licence.nom, prix: licence.prix, actif: newActif, streams_limite: licence.streams_limite })
    } catch {
      setLicences(l => l.map(x => x.id === licence.id ? { ...x, actif: licence.actif } : x))
    }
  }

  function openEdit(licence: Licence) {
    setEditId(licence.id)
    setForm({
      nom: licence.nom,
      prix: String(licence.prix),
      streams_limite: licence.streams_limite != null ? String(licence.streams_limite) : '',
    })
    setErreur('')
  }

  async function saveEdit(licence: Licence) {
    setSaving(true)
    setErreur('')
    try {
      await patch(licence.id, { nom: form.nom, prix: form.prix, actif: licence.actif, streams_limite: form.streams_limite || null })
      setLicences(l => l.map(x => x.id === licence.id ? {
        ...x,
        nom: form.nom,
        prix: parseInt(form.prix),
        streams_limite: form.streams_limite ? parseInt(form.streams_limite) : null,
      } : x))
      setEditId(null)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
          <h1 className="text-2xl font-bold">Mes licences</h1>
        </div>

        <p className="text-sm text-gray-400 mb-8">
          Ces licences s&apos;appliquent à tous tes beats par défaut. Tu peux activer ou désactiver une licence spécifiquement sur chaque beat.
        </p>

        <div className="flex flex-col gap-3">
          {licences.map(licence => (
            <div key={licence.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div
                  onClick={() => toggleActif(licence)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${licence.actif ? 'bg-indigo-600' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${licence.actif ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{licence.nom}</span>
                    <span className="text-indigo-400 font-medium text-sm">{licence.prix}€</span>
                    {MODELE_BADGES[licence.modele]?.map(b => (
                      <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{b}</span>
                    ))}
                    {licence.streams_limite && (
                      <span className="text-xs text-gray-500">{licence.streams_limite.toLocaleString()} streams</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => editId === licence.id ? setEditId(null) : openEdit(licence)}
                  className="text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0"
                >
                  {editId === licence.id ? 'Fermer' : 'Modifier'}
                </button>
              </div>

              {editId === licence.id && (
                <div className="border-t border-gray-800 px-5 py-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Nom</label>
                      <input
                        type="text"
                        value={form.nom}
                        onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Prix (€)</label>
                      <input
                        type="number"
                        value={form.prix}
                        onChange={e => setForm(f => ({ ...f, prix: e.target.value }))}
                        min={1}
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Limite de streams <span className="text-gray-600">(laisser vide = illimité)</span></label>
                    <input
                      type="number"
                      value={form.streams_limite}
                      onChange={e => setForm(f => ({ ...f, streams_limite: e.target.value }))}
                      placeholder="ex : 100000"
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  </div>
                  {erreur && <p className="text-red-400 text-sm">{erreur}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => saveEdit(licence)}
                      disabled={saving}
                      className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
