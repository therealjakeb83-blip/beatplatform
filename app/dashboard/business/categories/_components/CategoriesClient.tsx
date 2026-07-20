'use client'

import { useState, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { CategorieRow, TypeCategorie } from '@/lib/categories'
import { estOfficielle } from '@/lib/categories'

type CategorieAvecDonnees = CategorieRow & {
  nb_beats: number; ventes: number; ca_net: number; ecoutes: number
  image_override: string | null
}

type Props = {
  categories: CategorieAvecDonnees[]
  beatmakerId: string
  demanderCertification: (id: string) => Promise<{ erreur?: string }>
  annulerDemandeCertification: (id: string) => Promise<{ erreur?: string }>
  supprimerCategoriePersonnelle: (id: string) => Promise<{ erreur?: string }>
  renommerCategoriePerso: (id: string, nom: string) => Promise<{ erreur?: string }>
}

const ONGLETS: { type: TypeCategorie; label: string; hybride: boolean }[] = [
  { type: 'styles', label: 'Styles', hybride: true },
  { type: 'ambiances', label: 'Ambiances', hybride: false },
  { type: 'instruments', label: 'Instruments', hybride: false },
  { type: 'type_beat', label: 'Type Beat', hybride: true },
]

// Les images ne sont pour l'instant proposées que sur Type Beat (photo
// d'artiste) — décision Jake du 2026-07-20, facile à ouvrir aux autres
// types plus tard en retirant cette condition.
function avecImage(type: TypeCategorie) {
  return type === 'type_beat'
}

export default function CategoriesClient({
  categories,
  beatmakerId,
  demanderCertification,
  annulerDemandeCertification,
  supprimerCategoriePersonnelle,
  renommerCategoriePerso,
}: Props) {
  const [ongletActif, setOngletActif] = useState<TypeCategorie>('styles')
  const onglet = ONGLETS.find(o => o.type === ongletActif)!
  const categoriesType = categories.filter(c => c.type === ongletActif)
  const officielles = categoriesType.filter(estOfficielle).sort((a, b) => b.nb_beats - a.nb_beats)
  const personnelles = categoriesType.filter(c => c.beatmaker_id === beatmakerId)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Catégories</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ambiances et Instruments sont fixés par la plateforme. Styles et Type Beat sont libres : ajoute les tiens depuis la fiche d&apos;un beat, puis demande leur certification ici pour les rendre officielles.
          </p>
        </div>

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

        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-white">Catégories officielles</p>
          <p className="text-xs text-gray-500 mb-2">
            {onglet.hybride ? 'Disponibles pour tous les beatmakers, non modifiables.' : 'Fixées par la plateforme, non modifiables.'}
          </p>
          {officielles.length === 0 ? (
            <p className="text-xs text-gray-600">Aucune catégorie pour l&apos;instant.</p>
          ) : (
            <TableOfficielles categories={officielles} avecImage={avecImage(ongletActif)} />
          )}
        </div>

        {onglet.hybride && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-white">Tes catégories personnalisées</p>
              <p className="text-xs text-gray-500 mt-0.5">Ajoutées depuis la fiche d&apos;un beat — visibles uniquement par toi tant qu&apos;elles ne sont pas certifiées.</p>
            </div>
            {personnelles.length === 0 ? (
              <p className="text-xs text-gray-600">Aucune catégorie personnalisée pour l&apos;instant.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {personnelles.map(c => (
                  <CategoriePersonnelleRow
                    key={c.id}
                    categorie={c}
                    avecImage={avecImage(ongletActif)}
                    demanderCertification={demanderCertification}
                    annulerDemandeCertification={annulerDemandeCertification}
                    supprimerCategoriePersonnelle={supprimerCategoriePersonnelle}
                    renommerCategoriePerso={renommerCategoriePerso}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TableOfficielles({ categories, avecImage }: { categories: CategorieAvecDonnees[]; avecImage: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-800">
            <th className="pb-2 font-medium">Nom</th>
            <th className="pb-2 font-medium text-right">Beats</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(c => (
            <Fragment key={c.id}>
              <tr className="border-b border-gray-800/60 last:border-0">
                <td className="py-2 text-white font-medium">
                  {avecImage ? (
                    <button type="button" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="hover:text-indigo-400 transition-colors text-left">
                      {c.nom}
                    </button>
                  ) : c.nom}
                </td>
                <td className="py-2 text-right text-gray-400">{c.nb_beats}</td>
              </tr>
              {avecImage && expandedId === c.id && (
                <tr>
                  <td colSpan={2} className="bg-gray-950 border-b border-gray-800 px-2 py-3">
                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Image officielle</p>
                        {c.image_url
                          ? <img src={c.image_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-800" />
                          : <p className="text-xs text-gray-600">Aucune pour l&apos;instant.</p>}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Ton image pour ta boutique (optionnel)</p>
                        <ImageUploader categorieId={c.id} imageUrl={c.image_override} label={c.image_override ? 'Changer' : 'Ajouter une image'} />
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CategoriePersonnelleRow({
  categorie,
  avecImage,
  demanderCertification,
  annulerDemandeCertification,
  supprimerCategoriePersonnelle,
  renommerCategoriePerso,
}: {
  categorie: CategorieAvecDonnees
  avecImage: boolean
  demanderCertification: (id: string) => Promise<{ erreur?: string }>
  annulerDemandeCertification: (id: string) => Promise<{ erreur?: string }>
  supprimerCategoriePersonnelle: (id: string) => Promise<{ erreur?: string }>
  renommerCategoriePerso: (id: string, nom: string) => Promise<{ erreur?: string }>
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [ouvert, setOuvert] = useState(false)

  async function action(fn: (id: string) => Promise<{ erreur?: string }>) {
    setEnCours(true)
    setErreur('')
    const { erreur: err } = await fn(categorie.id)
    setEnCours(false)
    if (err) setErreur(err)
  }

  const peutEditer = categorie.statut !== 'certifiee' || avecImage
  const peutRenommer = categorie.statut !== 'certifiee'

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          {peutEditer ? (
            <button type="button" onClick={() => setOuvert(!ouvert)} className="text-sm text-white font-medium hover:text-indigo-400 transition-colors">
              {categorie.nom}
            </button>
          ) : (
            <span className="text-sm text-white font-medium">{categorie.nom}</span>
          )}
          <span className="text-xs text-gray-500">{categorie.nb_beats} beat{categorie.nb_beats !== 1 ? 's' : ''}</span>
          {categorie.statut === 'active' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Perso</span>
          )}
          {categorie.statut === 'en_attente_certification' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">En attente de validation</span>
          )}
          {categorie.statut === 'certifiee' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Certifiée ✓</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {erreur && <span className="text-xs text-red-400">{erreur}</span>}
          {categorie.statut === 'active' && (
            <>
              <button
                onClick={() => action(demanderCertification)}
                disabled={enCours}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
              >
                Demander la certification
              </button>
              <button
                onClick={() => action(supprimerCategoriePersonnelle)}
                disabled={enCours}
                className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                aria-label="Supprimer"
              >
                ✕
              </button>
            </>
          )}
          {categorie.statut === 'en_attente_certification' && (
            <button
              onClick={() => action(annulerDemandeCertification)}
              disabled={enCours}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
            >
              Annuler la demande
            </button>
          )}
        </div>
      </div>

      {ouvert && peutEditer && (
        <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-8">
          {peutRenommer && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Renommer</p>
              <RenommerForm categorie={categorie} renommerCategoriePerso={renommerCategoriePerso} />
            </div>
          )}
          {avecImage && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Image</p>
              <ImageUploader categorieId={categorie.id} imageUrl={categorie.image_url} label={categorie.image_url ? 'Changer' : 'Ajouter une image'} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RenommerForm({ categorie, renommerCategoriePerso }: {
  categorie: CategorieRow
  renommerCategoriePerso: (id: string, nom: string) => Promise<{ erreur?: string }>
}) {
  const router = useRouter()
  const [nom, setNom] = useState(categorie.nom)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valeur = nom.trim()
    if (!valeur || valeur === categorie.nom) return
    setEnCours(true)
    setErreur('')
    const { erreur: err } = await renommerCategoriePerso(categorie.id, valeur)
    setEnCours(false)
    if (err) setErreur(err)
    else router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input type="text" value={nom} onChange={e => setNom(e.target.value)}
        className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-sm focus:outline-none focus:border-indigo-500" />
      <button type="submit" disabled={enCours || !nom.trim() || nom.trim() === categorie.nom}
        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
        Renommer
      </button>
      {erreur && <span className="text-xs text-red-400">{erreur}</span>}
    </form>
  )
}

function ImageUploader({ categorieId, imageUrl, label }: { categorieId: string; imageUrl: string | null; label: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnCours(true)
    setErreur('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('categorieId', categorieId)
    const res = await fetch('/api/upload/categorie-image', { method: 'POST', body: formData })
    const data = await res.json()
    setEnCours(false)
    if (!res.ok) { setErreur(data.error ?? 'Erreur upload'); return }
    if (inputRef.current) inputRef.current.value = ''
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {imageUrl
        ? <img src={imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-800" />
        : <div className="w-12 h-12 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600 text-xs">—</div>}
      <div>
        <label className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 cursor-pointer transition-colors inline-block">
          {enCours ? 'Envoi...' : label}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={enCours} />
        </label>
        {erreur && <p className="text-xs text-red-400 mt-1">{erreur}</p>}
      </div>
    </div>
  )
}
