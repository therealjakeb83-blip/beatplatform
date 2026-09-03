'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LicenceTexteForm({
  contenuInitial,
  templateParDefaut,
  version,
  updatedLe,
}: {
  contenuInitial: string
  templateParDefaut: string
  version: number | null
  updatedLe: string | null
}) {
  const router = useRouter()
  const [contenu, setContenu] = useState(contenuInitial)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState(false)

  function reinitialiserModele() {
    if (contenu.trim() && !window.confirm('Revenir au modèle par défaut ? Le texte actuel dans ce champ sera perdu (la version déjà enregistrée, si elle existe, n\'est pas touchée tant que tu n\'enregistres pas).')) {
      return
    }
    setContenu(templateParDefaut)
    setSucces(false)
  }

  async function enregistrer() {
    setSaving(true)
    setErreur('')
    setSucces(false)

    const res = await fetch('/api/licences/textes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_licence: 'standard', contenu }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setErreur(data.error ?? 'Erreur inconnue')
      return
    }

    setSucces(true)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm text-gray-300">Texte de la licence</label>
        <button
          type="button"
          onClick={reinitialiserModele}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          ↻ Utiliser le modèle par défaut
        </button>
      </div>

      <textarea
        value={contenu}
        onChange={e => { setContenu(e.target.value); setSucces(false) }}
        rows={24}
        className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono text-sm leading-relaxed"
      />

      <p className="text-xs text-gray-500 mt-2">
        {updatedLe
          ? `Enregistré — version ${version}, le ${new Date(updatedLe).toLocaleDateString('fr-FR')}`
          : 'Pas encore enregistré — le modèle par défaut est utilisé pour l\'instant sur tes contrats.'}
      </p>

      {erreur && <p className="text-red-400 text-sm mt-3">{erreur}</p>}
      {succes && <p className="text-green-400 text-sm mt-3">✓ Enregistré</p>}

      <button
        type="button"
        onClick={enregistrer}
        disabled={saving}
        className="mt-4 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </div>
  )
}
