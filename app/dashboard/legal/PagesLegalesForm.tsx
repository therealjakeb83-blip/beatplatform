'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  type TypePageLegale,
  type InfosLegalesBeatmaker,
  CHAMPS_INFOS_LEGALES,
  resoudreVariables,
  infosLegalesCompletes,
} from '@/lib/pages-legales'

type Page = {
  type: TypePageLegale
  titre: string
  route: string
  contenuActuel: string | null
  templateBrut: string
  version: number | null
  adopteLe: string | null
}

export default function PagesLegalesForm({
  pages,
  slug,
  infosInitiales,
}: {
  pages: Page[]
  slug: string
  infosInitiales: InfosLegalesBeatmaker
}) {
  const router = useRouter()
  const [ongletActif, setOngletActif] = useState<TypePageLegale>(pages[0].type)
  const [infos, setInfos] = useState<InfosLegalesBeatmaker>(infosInitiales)
  const [savingInfos, setSavingInfos] = useState(false)
  const [succesInfos, setSuccesInfos] = useState(false)

  const [contenus, setContenus] = useState<Record<TypePageLegale, string>>(
    Object.fromEntries(
      pages.map(p => [p.type, p.contenuActuel ?? resoudreVariables(p.templateBrut, infosInitiales)])
    ) as Record<TypePageLegale, string>
  )
  // Pages jamais publiées ET jamais modifiées à la main dans cette session
  // — leur aperçu se met à jour automatiquement quand les infos légales
  // sont enregistrées. Dès que le beatmaker tape dans le champ, la page
  // sort de cet ensemble : on ne réécrit jamais un texte qu'il a lui-même
  // commencé à modifier.
  const [pagesAutoMaj, setPagesAutoMaj] = useState<Set<TypePageLegale>>(
    new Set(pages.filter(p => p.contenuActuel === null).map(p => p.type))
  )

  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState<TypePageLegale | null>(null)

  const page = pages.find(p => p.type === ongletActif)!
  const complet = infosLegalesCompletes(infos)

  async function enregistrerInfos() {
    setSavingInfos(true)
    setSuccesInfos(false)

    const res = await fetch('/api/profil/infos-legales', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(infos),
    })

    setSavingInfos(false)
    if (!res.ok) return

    // Met à jour l'aperçu des pages pas encore publiées et pas encore
    // touchées à la main, avec les nouvelles infos.
    setContenus(prev => {
      const next = { ...prev }
      for (const p of pages) {
        if (pagesAutoMaj.has(p.type)) next[p.type] = resoudreVariables(p.templateBrut, infos)
      }
      return next
    })
    setSuccesInfos(true)
    router.refresh()
  }

  function modifierContenu(type: TypePageLegale, valeur: string) {
    setContenus({ ...contenus, [type]: valeur })
    if (pagesAutoMaj.has(type)) {
      const next = new Set(pagesAutoMaj)
      next.delete(type)
      setPagesAutoMaj(next)
    }
  }

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
      {/* Infos légales — utilisées comme variables dans les modèles */}
      <div className="mb-8 p-5 rounded-lg bg-gray-900 border border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Tes informations légales</h2>
        <p className="text-xs text-gray-500 mb-4">
          Utilisées pour remplir automatiquement les modèles ci-dessous (nom, SIRET, adresse, contact). Modifie-les
          ici une seule fois plutôt que dans chaque page — {!complet && 'à compléter avant de publier tes pages légales.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHAMPS_INFOS_LEGALES.map(({ cle, label, placeholder }) => (
            <div key={cle}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                type="text"
                value={infos[cle] ?? ''}
                onChange={e => setInfos({ ...infos, [cle]: e.target.value })}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={enregistrerInfos}
            disabled={savingInfos}
            className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {savingInfos ? 'Enregistrement...' : 'Enregistrer mes informations'}
          </button>
          {succesInfos && <span className="text-green-400 text-xs">✓ Enregistré</span>}
        </div>
      </div>

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
        {page.adopteLe && (
          <a
            href={`/${slug}/${page.route}`}
            target="_blank"
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Voir la page en ligne ↗
          </a>
        )}
      </div>

      <textarea
        value={contenus[ongletActif]}
        onChange={e => modifierContenu(ongletActif, e.target.value)}
        rows={16}
        className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono text-sm leading-relaxed"
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">
          {page.adopteLe
            ? `Publiée — version ${page.version}, enregistrée le ${new Date(page.adopteLe).toLocaleDateString('fr-FR')}`
            : 'Pas encore publiée — tes clients ne voient rien tant que tu n\'as pas cliqué "Enregistrer et publier"'}
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
