'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TypePageLegale } from '@/lib/pages-legales'

type Page = {
  type: TypePageLegale
  titre: string
  route: string
  contenu: string
  version: number | null
  adopteLe: string | null
}

export default function PagesLegalesForm({ pages, slug }: { pages: Page[]; slug: string }) {
  const router = useRouter()
  const [ongletActif, setOngletActif] = useState<TypePageLegale>(pages[0].type)
  const [contenus, setContenus] = useState<Record<TypePageLegale, string>>(
    Object.fromEntries(pages.map(p => [p.type, p.contenu])) as Record<TypePageLegale, string>
  )
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState<TypePageLegale | null>(null)

  const page = pages.find(p => p.type === ongletActif)!

  async function enregistrer() {
    setSaving(true)
    setErreur('')
    setSucces(null)

    const res = await fetch('/api/profil/pages-legales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_page: ongletActif, contenu: contenus[ongletActif] }),
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
        {pages.map(p => (
          <button
            key={p.type}
            type="button"
            onClick={() => { setOngletActif(p.type); setSucces(null); setErreur('') }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              ongletActif === p.type
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {p.titre}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm text-gray-300">{page.titre}</label>
        <a
          href={`/${slug}/${page.route}`}
          target="_blank"
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          Voir la page en ligne ↗
        </a>
      </div>

      <textarea
        value={contenus[ongletActif]}
        onChange={e => setContenus({ ...contenus, [ongletActif]: e.target.value })}
        rows={16}
        className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono text-sm leading-relaxed"
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">
          {page.adopteLe
            ? `Version ${page.version} — enregistrée le ${new Date(page.adopteLe).toLocaleDateString('fr-FR')}`
            : 'Modèle proposé par My Producer — pas encore enregistré'}
        </p>
      </div>

      {erreur && <p className="text-red-400 text-sm mt-3">{erreur}</p>}
      {succes === ongletActif && <p className="text-green-400 text-sm mt-3">✓ Enregistré et publié</p>}

      <button
        type="button"
        onClick={enregistrer}
        disabled={saving}
        className="mt-4 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer et publier'}
      </button>
    </div>
  )
}
