'use client'

import { useState } from 'react'
import type { CategorieRow, TypeCategorie } from '@/lib/categories'

type Props = {
  categories: CategorieRow[]
  beatmakerId: string
  moderateur: boolean
  demandesEnAttente: (CategorieRow & { nom_artiste: string | null })[]
  demanderCertification: (id: string) => Promise<{ erreur?: string }>
  annulerDemandeCertification: (id: string) => Promise<{ erreur?: string }>
  supprimerCategoriePersonnelle: (id: string) => Promise<{ erreur?: string }>
  approuverCertification: (id: string) => Promise<{ erreur?: string }>
  rejeterCertification: (id: string) => Promise<{ erreur?: string }>
}

const ONGLETS: { type: TypeCategorie; label: string; hybride: boolean }[] = [
  { type: 'styles', label: 'Styles', hybride: true },
  { type: 'ambiances', label: 'Ambiances', hybride: false },
  { type: 'instruments', label: 'Instruments', hybride: false },
  { type: 'type_beat', label: 'Type Beat', hybride: true },
]

export default function CategoriesClient({
  categories,
  beatmakerId,
  moderateur,
  demandesEnAttente,
  demanderCertification,
  annulerDemandeCertification,
  supprimerCategoriePersonnelle,
  approuverCertification,
  rejeterCertification,
}: Props) {
  const [ongletActif, setOngletActif] = useState<TypeCategorie>('styles')
  const onglet = ONGLETS.find(o => o.type === ongletActif)!
  const categoriesType = categories.filter(c => c.type === ongletActif)
  const officielles = categoriesType.filter(c => c.source === 'plateforme' || c.statut === 'certifiee')
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

        {moderateur && demandesEnAttente.length > 0 && (
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

        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-white">Catégories officielles</p>
          <p className="text-xs text-gray-500 mb-2">
            {onglet.hybride ? 'Disponibles pour tous les beatmakers, non modifiables.' : 'Fixées par la plateforme, non modifiables.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {officielles.length === 0 && <p className="text-xs text-gray-600">Aucune catégorie pour l&apos;instant.</p>}
            {officielles.map(c => (
              <span key={c.id} className="px-3 py-1 rounded-full text-sm font-medium bg-gray-800 text-gray-300">
                {c.nom}
              </span>
            ))}
          </div>
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
                    demanderCertification={demanderCertification}
                    annulerDemandeCertification={annulerDemandeCertification}
                    supprimerCategoriePersonnelle={supprimerCategoriePersonnelle}
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

function CategoriePersonnelleRow({
  categorie,
  demanderCertification,
  annulerDemandeCertification,
  supprimerCategoriePersonnelle,
}: {
  categorie: CategorieRow
  demanderCertification: (id: string) => Promise<{ erreur?: string }>
  annulerDemandeCertification: (id: string) => Promise<{ erreur?: string }>
  supprimerCategoriePersonnelle: (id: string) => Promise<{ erreur?: string }>
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  async function action(fn: (id: string) => Promise<{ erreur?: string }>) {
    setEnCours(true)
    setErreur('')
    const { erreur: err } = await fn(categorie.id)
    setEnCours(false)
    if (err) setErreur(err)
  }

  return (
    <div className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-white font-medium">{categorie.nom}</span>
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
  )
}

function ModerationSection({
  demandes,
  approuverCertification,
  rejeterCertification,
}: {
  demandes: (CategorieRow & { nom_artiste: string | null })[]
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

  const NOMS_TYPE: Record<TypeCategorie, string> = {
    styles: 'Style', ambiances: 'Ambiance', instruments: 'Instrument', type_beat: 'Type Beat',
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-300">Demandes de certification en attente ({demandes.length})</p>
        <p className="text-xs text-amber-400/70 mt-0.5">Modération interne V1 — à remplacer par un vrai back-office Admin (étape 15).</p>
      </div>
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
