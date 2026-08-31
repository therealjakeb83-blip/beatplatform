'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { LitigeRow } from '../page'

const STATUT = {
  en_cours: { label: 'En cours', cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' },
  gagne:    { label: 'Gagné',    cls: 'bg-green-500/15  text-green-400  border border-green-500/20' },
  perdu:    { label: 'Perdu',    cls: 'bg-red-500/15    text-red-400    border border-red-500/20' },
} as const

const TABS: { label: string; value: '' | LitigeRow['statut'] }[] = [
  { label: 'Tous',      value: '' },
  { label: 'En cours',  value: 'en_cours' },
  { label: 'Gagné',     value: 'gagne' },
  { label: 'Perdu',     value: 'perdu' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LitigesClient({ litiges }: { litiges: LitigeRow[] }) {
  const [tab, setTab] = useState<'' | LitigeRow['statut']>('')

  const counts = useMemo(() => ({
    '':        litiges.length,
    en_cours:  litiges.filter(l => l.statut === 'en_cours').length,
    gagne:     litiges.filter(l => l.statut === 'gagne').length,
    perdu:     litiges.filter(l => l.statut === 'perdu').length,
  }), [litiges])

  const filtres = tab ? litiges.filter(l => l.statut === tab) : litiges
  const montantEnCours = litiges.filter(l => l.statut === 'en_cours').reduce((s, l) => s + l.montant, 0)

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Litiges</h1>
        <p className="text-sm text-gray-400 mt-1">
          Litiges Stripe (contestations bancaires) sur tes ventes — affichage seul, Stripe gère le déroulement directement avec toi sur ton compte connecté.
          {montantEnCours > 0 && <span className="text-orange-400"> {montantEnCours.toFixed(2)}€ actuellement séquestrés.</span>}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-px">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label} <span className="text-gray-600">{counts[t.value]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Date de début</th>
                <th className="text-left px-4 py-3">Date de fin</th>
                <th className="text-right px-4 py-3">Commande</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map(l => {
                const s = STATUT[l.statut]
                return (
                  <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-200 font-medium">{l.montant.toFixed(2)}€</td>
                    <td className="px-4 py-3 text-gray-300">{fmtDate(l.ouvert_le)}</td>
                    <td className="px-4 py-3 text-gray-400">{l.ferme_le ? fmtDate(l.ferme_le) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/business/commandes/${l.commande_id}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                        Voir →
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {filtres.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-600">Aucun litige{tab ? ` "${STATUT[tab].label}"` : ''}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
