'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TypeLicenceTexte } from '@/lib/licences-textes'

type Categorie = {
  type: TypeLicenceTexte
  titre: string
  contenuActuel: string | null
  templateParDefaut: string
  version: number | null
  updatedLe: string | null
}

export default function LicenceTexteForm({ categories }: { categories: Categorie[] }) {
  const router = useRouter()
  const [ongletActif, setOngletActif] = useState<TypeLicenceTexte>(categories[0].type)
  const [contenus, setContenus] = useState<Record<string, string>>(
    Object.fromEntries(categories.map(c => [c.type, c.contenuActuel ?? c.templateParDefaut]))
  )
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState<TypeLicenceTexte | null>(null)

  const categorie = categories.find(c => c.type === ongletActif)!

  function reinitialiserModele() {
    if (contenus[ongletActif].trim() && !window.confirm('Revenir au modèle par défaut ? Le texte actuel dans ce champ sera perdu (la version déjà enregistrée, si elle existe, n\'est pas touchée tant que tu n\'enregistres pas).')) {
      return
    }
    setContenus({ ...contenus, [ongletActif]: categorie.templateParDefaut })
    setSucces(null)
  }

  async function enregistrer() {
    setSaving(true)
    setErreur('')
    setSucces(null)

    const res = await fetch('/api/licences/textes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_licence: ongletActif, contenu: contenus[ongletActif] }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setErreur(data.error ?? 'Erreur inconnue')
      return
    }

    setSucces(ongletActif)
    router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-800 pb-4">
        {categories.map(c => (
          <button
            key={c.type}
            type="button"
            onClick={() => { setOngletActif(c.type); setSucces(null); setErreur('') }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ongletActif === c.type
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {c.titre}
          </button>
        ))}
      </div>

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
        value={contenus[ongletActif]}
        onChange={e => { setContenus({ ...contenus, [ongletActif]: e.target.value }); setSucces(null) }}
        rows={24}
        className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono text-sm leading-relaxed"
      />

      <p className="text-xs text-gray-500 mt-2">
        {categorie.updatedLe
          ? `Enregistré — version ${categorie.version}, le ${new Date(categorie.updatedLe).toLocaleDateString('fr-FR')}`
          : 'Pas encore enregistré — le modèle par défaut est utilisé pour l\'instant sur tes contrats.'}
      </p>

      {erreur && <p className="text-red-400 text-sm mt-3">{erreur}</p>}
      {succes === ongletActif && <p className="text-green-400 text-sm mt-3">✓ Enregistré</p>}

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
