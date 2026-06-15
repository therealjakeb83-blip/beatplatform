'use client'

import { useState } from 'react'
import Link from 'next/link'
import IgnorerButton from './IgnorerButton'

export type ClientData = {
  id: string
  prenom: string | null
  nom: string | null
  email: string
  pays: string | null
  telephone: string | null
  ltv: number
  nb_achats: number
  statut_abo: 'actif' | 'ancien' | null
}

export type RaisonData = {
  champ: 'email' | 'nom' | 'telephone'
  type: 'exact' | 'similaire'
  score: number
}

export type DoublonPairData = {
  a: ClientData
  b: ClientData
  raisons: RaisonData[]
  confiance: 'haute' | 'probable'
}

const CHAMP_LABELS: Record<RaisonData['champ'], string> = {
  email:     'Email',
  nom:       'Nom complet',
  telephone: 'Téléphone',
}

const CHAMP_COLORS: Record<RaisonData['champ'], string> = {
  email:     'bg-red-500/15 text-red-400 border-red-500/20',
  nom:       'bg-orange-500/15 text-orange-400 border-orange-500/20',
  telephone: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
}

function Avatar({ client }: { client: ClientData }) {
  const initiales = [client.prenom?.[0], client.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
      {client.pays ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/w40/${client.pays.toLowerCase()}.png`}
          alt={client.pays}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xs text-indigo-300 font-bold">{initiales}</span>
      )}
    </div>
  )
}

function formatLtv(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function DoublonsView({ paires }: { paires: DoublonPairData[] }) {
  const hauteConfiance = paires.filter(p => p.confiance === 'haute').length
  const probable       = paires.filter(p => p.confiance === 'probable').length

  const [filtre, setFiltre] = useState<'haute' | 'probable' | ''>('')

  function toggleFiltre(val: 'haute' | 'probable') {
    setFiltre(prev => prev === val ? '' : val)
  }

  const displayed = filtre ? paires.filter(p => p.confiance === filtre) : paires

  const kpiBase = 'bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all select-none'

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div
          className={`${kpiBase} border-gray-800 ${filtre === '' ? '' : 'opacity-50'}`}
          onClick={() => setFiltre('')}
        >
          <p className="text-xs text-gray-500 mb-1">Total détectés</p>
          <p className="text-2xl font-black text-white">{paires.length}</p>
          <p className="text-xs text-gray-700 mt-1">correspondances détectées</p>
        </div>
        <div
          className={`${kpiBase} ${filtre === 'haute' ? 'border-red-500/60 ring-1 ring-red-500/30' : 'border-red-500/20 hover:border-red-500/40'}`}
          onClick={() => toggleFiltre('haute')}
        >
          <p className="text-xs text-gray-500 mb-1">Confiance haute</p>
          <p className="text-2xl font-black text-red-400">{hauteConfiance}</p>
          <p className="text-xs text-gray-700 mt-1">à traiter en priorité</p>
        </div>
        <div
          className={`${kpiBase} ${filtre === 'probable' ? 'border-orange-500/60 ring-1 ring-orange-500/30' : 'border-orange-500/20 hover:border-orange-500/40'}`}
          onClick={() => toggleFiltre('probable')}
        >
          <p className="text-xs text-gray-500 mb-1">Probable</p>
          <p className="text-2xl font-black text-orange-400">{probable}</p>
          <p className="text-xs text-gray-700 mt-1">à vérifier manuellement</p>
        </div>
      </div>

      {/* Liste */}
      {displayed.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center text-gray-600 text-sm">
          {paires.length === 0
            ? 'Aucun doublon détecté — tes contacts sont tous distincts.'
            : 'Aucun doublon dans cette catégorie.'}
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((pair, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

              {/* En-tête */}
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                  pair.confiance === 'haute'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                }`}>
                  {pair.confiance === 'haute' ? 'Confiance haute' : 'Probable'}
                </span>
                {pair.raisons.map((r, ri) => (
                  <span key={ri} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CHAMP_COLORS[r.champ]}`}>
                    {CHAMP_LABELS[r.champ]} {r.type === 'similaire' ? `≈ ${Math.round(r.score * 100)}%` : '='}
                  </span>
                ))}
              </div>

              {/* Les deux contacts */}
              <div className="grid grid-cols-2 divide-x divide-gray-800">
                {[pair.a, pair.b].map((c) => (
                  <div key={c.id} className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar client={c} />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-white truncate">
                          {c.prenom} {c.nom}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{c.email}</p>
                      </div>
                    </div>

                    {c.telephone && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400">📞 {c.telephone}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-3 border-t border-gray-800">
                      <div>
                        <p className="text-gray-600 text-[10px] uppercase tracking-wide">Achats</p>
                        <p className="text-sm font-bold text-white">{c.nb_achats}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-[10px] uppercase tracking-wide">LTV</p>
                        <p className="text-sm font-bold text-white">{formatLtv(c.ltv)}</p>
                      </div>
                      {c.statut_abo === 'actif'  && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Abonné</span>
                      )}
                      {c.statut_abo === 'ancien' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-500 font-medium">Ancien abo</span>
                      )}
                      <Link
                        href={`/dashboard/business/contacts/${c.id}`}
                        className="ml-auto text-xs text-gray-600 hover:text-indigo-400 transition-colors"
                      >
                        Voir la fiche →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-3">
                <button
                  disabled
                  title="Bientôt disponible"
                  className="text-xs px-4 py-1.5 rounded-xl bg-indigo-600/30 text-indigo-400/50 font-semibold cursor-not-allowed"
                >
                  Fusionner
                </button>
                <IgnorerButton id1={pair.a.id} id2={pair.b.id} />
                <p className="text-xs text-gray-700">
                  La fusion conserve la fiche avec la LTV la plus haute et migre toutes les commandes
                </p>
              </div>

            </div>
          ))}
        </div>
      )}
    </>
  )
}
