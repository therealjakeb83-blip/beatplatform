'use client'

import { useState } from 'react'
import type { CategorieRow, TypeCategorie } from '@/lib/categories'

type CategorieAvecArtiste = CategorieRow & { nom_artiste: string | null }

type Props = {
  categories: CategorieAvecArtiste[]
  approuverCertification: (id: string) => Promise<{ erreur?: string }>
  rejeterCertification: (id: string) => Promise<{ erreur?: string }>
  ajouterCategoriePlateforme: (type: TypeCategorie, nom: string) => Promise<{ erreur?: string }>
  supprimerCategoriePlateforme: (id: string) => Promise<{ erreur?: string }>
}

const ONGLETS: { type: TypeCategorie; label: string }[] = [
  { type: 'styles', label: 'Styles' },
  { type: 'ambiances', label: 'Ambiances' },
  { type: 'instruments', label: 'Instruments' },
  { type: 'type_beat', label: 'Type Beat' },
]

const NOMS_TYPE: Record<TypeCategorie, string> = {
  styles: 'Style', ambiances: 'Ambiance', instruments: 'Instrument', type_beat: 'Type Beat',
}

export default function AdminCategoriesClient({
  categories,
  approuverCertification,
  rejeterCertification,
  ajouterCategoriePlateforme,
  supprimerCategoriePlateforme,
}: Props) {
  const [ongletActif, setOngletActif] = useState<TypeCategorie>('styles')
  const demandesEnAttente = categories.filter(c => c.statut === 'en_attente_certification')
  const officielles = categories.filter(c => c.type === ongletActif && c.source === 'plateforme')

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Catégories</h1>
        <p className="text-sm text-gray-500 mt-0.5">Modération des demandes de certification et gestion des catégories officielles (source plateforme).</p>
      </div>

      {demandesEnAttente.length > 0 && (
        <ModerationSection
          demandes={demandesEnAttente}
          approuverCertification={approuverCertification}
          rejeterCertification={rejeterCertification}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {ONGLETS.map(o => (
          <button
            key={o.type}
            onClick={() => setOngletActif(o.type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              ongletActif === o.type
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-white">Catégories officielles — {ONGLETS.find(o => o.type === ongletActif)!.label}</p>
        <div className="flex flex-wrap gap-2">
          {officielles.length === 0 && <p className="text-xs text-gray-600">Aucune catégorie pour l&apos;instant.</p>}
          {officielles.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-800 text-gray-300">
              {c.nom}
              <SupprimerBouton categorieId={c.id} supprimerCategoriePlateforme={supprimerCategoriePlateforme} />
            </span>
          ))}
        </div>
        <AjouterForm type={ongletActif} ajouterCategoriePlateforme={ajouterCategoriePlateforme} />
      </div>
    </div>
  )
}

function ModerationSection({
  demandes,
  approuverCertification,
  rejeterCertification,
}: {
  demandes: CategorieAvecArtiste[]
  approuverCertification: (id: string) => Promise<{ erreur?: string }>
  rejeterCertification: (id: string) => Promise<{ erreur?: string }>
}) {
  const [traitementId, setTraitementId] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')

  async function traiter(id: string, fn: (id: string) => Promise<{ erreur?: string }>) {
    setTraitementId(id)
    setErreur('')
    const { erreur: err } = await fn(id)
    setTraitementId(null)
    if (err) setErreur(err)
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 space-y-3">
      <p className="text-sm font-semibold text-amber-300">Demandes de certification en attente ({demandes.length})</p>
      {erreur && <p className="text-xs text-red-400">{erreur}</p>}
      <div className="flex flex-col gap-2">
        {demandes.map(d => (
          <div key={d.id} className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white font-medium">{d.nom}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{NOMS_TYPE[d.type]}</span>
              <span className="text-xs text-gray-500">par {d.nom_artiste ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => traiter(d.id, approuverCertification)}
                disabled={traitementId === d.id}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50"
              >
                Approuver
              </button>
              <button
                onClick={() => traiter(d.id, rejeterCertification)}
                disabled={traitementId === d.id}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
              >
                Rejeter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SupprimerBouton({
  categorieId,
  supprimerCategoriePlateforme,
}: {
  categorieId: string
  supprimerCategoriePlateforme: (id: string) => Promise<{ erreur?: string }>
}) {
  const [enCours, setEnCours] = useState(false)

  async function handleClick() {
    if (!confirm('Supprimer cette catégorie officielle ?')) return
    setEnCours(true)
    await supprimerCategoriePlateforme(categorieId)
    setEnCours(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={enCours}
      className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
      aria-label="Supprimer"
    >
      ✕
    </button>
  )
}

function AjouterForm({
  type,
  ajouterCategoriePlateforme,
}: {
  type: TypeCategorie
  ajouterCategoriePlateforme: (type: TypeCategorie, nom: string) => Promise<{ erreur?: string }>
}) {
  const [nom, setNom] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setEnCours(true)
    setErreur('')
    const { erreur: err } = await ajouterCategoriePlateforme(type, nom)
    setEnCours(false)
    if (err) setErreur(err)
    else setNom('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2 border-t border-gray-800">
      <input
        type="text"
        value={nom}
        onChange={e => setNom(e.target.value)}
        placeholder="Nouvelle catégorie officielle..."
        className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
      />
      <button
        type="submit"
        disabled={enCours || !nom.trim()}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        Ajouter
      </button>
      {erreur && <span className="text-xs text-red-400">{erreur}</span>}
    </form>
  )
}
