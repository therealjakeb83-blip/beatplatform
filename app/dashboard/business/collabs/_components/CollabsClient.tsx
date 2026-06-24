'use client'

import { useState } from 'react'
import type { SplitRow } from '../page'

type Onglet = 'collabs' | 'demandes' | 'refusees'

const ONGLETS: { label: string; value: Onglet }[] = [
  { label: 'Mes collabs', value: 'collabs'  },
  { label: 'Demandes',    value: 'demandes' },
  { label: 'Refusées',    value: 'refusees' },
]

function BeatCover({ beat }: { beat: SplitRow['beats'] }) {
  if (!beat) return <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0" />
  return (
    <div
      className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden"
      style={!beat.image_url ? { backgroundColor: beat.couleur ?? '#374151' } : undefined}
    >
      {beat.image_url ? (
        <img src={beat.image_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
          {beat.titre.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

export default function CollabsClient({
  splits: initial,
  totalRecu,
  montantBloque,
}: {
  splits: SplitRow[]
  totalRecu: number
  montantBloque: number
}) {
  const [splits, setSplits] = useState(initial)
  const [onglet, setOnglet] = useState<Onglet>('collabs')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const actives  = splits.filter(s => s.statut === 'actif')
  const demandes = splits.filter(s => s.statut === 'en_attente')
  const refusees = splits.filter(s => s.statut === 'refuse')

  const counts: Record<Onglet, number> = {
    collabs:  actives.length,
    demandes: demandes.length,
    refusees: refusees.length,
  }

  async function accepter(id: string) {
    setLoadingId(id)
    const res = await fetch(`/api/business/collabs/${id}/accepter`, { method: 'POST' })
    if (res.ok) {
      setSplits(prev => prev.map(s =>
        s.id === id ? { ...s, statut: 'actif' as const, email_invite: null } : s
      ))
    }
    setLoadingId(null)
  }

  async function refuser(id: string) {
    setLoadingId(id)
    const res = await fetch(`/api/business/collabs/${id}/refuser`, { method: 'POST' })
    if (res.ok) {
      setSplits(prev => prev.map(s =>
        s.id === id ? { ...s, statut: 'refuse' as const } : s
      ))
    }
    setLoadingId(null)
  }

  return (
    <div className="px-8 py-8 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Collaborations</h1>
          <p className="text-sm text-gray-500 mt-1">
            {actives.length} beat{actives.length !== 1 ? 's' : ''} en collab
          </p>
        </div>
        <div className="text-right space-y-1">
          {totalRecu > 0 && (
            <div>
              <p className="text-xs text-gray-500">Reçu</p>
              <p className="text-xl font-black text-green-400">{totalRecu.toFixed(2)}€</p>
            </div>
          )}
          {montantBloque > 0 && (
            <div>
              <p className="text-xs text-gray-500">Bloqué (demandes)</p>
              <p className="text-lg font-bold text-amber-400">{montantBloque.toFixed(2)}€</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-6 border-b border-gray-800">
        {ONGLETS.map(o => (
          <button
            key={o.value}
            onClick={() => setOnglet(o.value)}
            className={`px-4 py-2.5 text-sm transition-colors relative ${
              onglet === o.value
                ? 'text-white font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {o.label}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              onglet === o.value ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-800 text-gray-500'
            }`}>
              {counts[o.value]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Mes collabs ── */}
      {onglet === 'collabs' && (
        <>
          {actives.length === 0 ? (
            <div className="text-center py-20 text-gray-600">
              <p className="text-base">Aucune collaboration pour l&apos;instant.</p>
              <p className="text-sm mt-2">Quand un beatmaker t&apos;ajoute sur un beat, il apparaîtra ici.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {actives.map(s => {
                const beat = s.beats
                const recu = s.split_payments
                  .filter(p => p.statut === 'transfere')
                  .reduce((sum, p) => sum + p.montant, 0) / 100
                const nbVentes = s.split_payments.filter(p => p.statut !== 'expire').length

                return (
                  <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-center">
                    <BeatCover beat={beat} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white truncate">{beat?.titre ?? 'Beat supprimé'}</p>
                        {beat && beat.statut !== 'public' && (
                          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">
                            {beat.statut === 'prive' ? 'Privé' : 'Brouillon'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Par {beat?.beatmakers?.nom_artiste ?? 'Beatmaker'} · Ta part : {s.pourcentage}%
                      </p>
                      {nbVentes > 0 && (
                        <p className="text-xs text-gray-500">{nbVentes} vente{nbVentes > 1 ? 's' : ''}</p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      {recu > 0 ? (
                        <p className="text-sm font-bold text-green-400">
                          +{recu.toFixed(2)}€ <span className="text-xs font-normal text-gray-500">reçu</span>
                        </p>
                      ) : (
                        <p className="text-xs text-gray-600">Pas encore vendu</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
            <p className="font-medium text-white mb-1">Recevoir tes revenus</p>
            <p>Pour recevoir les paiements de tes collaborations, connecte ton compte Stripe dans <a href="/dashboard/paiements" className="text-indigo-400 hover:text-indigo-300">Paiements</a>.</p>
          </div>
        </>
      )}

      {/* ── Demandes ── */}
      {onglet === 'demandes' && (
        <div className="flex flex-col gap-3">
          {demandes.length === 0 ? (
            <div className="text-center py-16 text-xs text-gray-700">Aucune demande en attente</div>
          ) : (
            demandes.map(s => {
              const beat = s.beats
              const montantEnAttente = s.split_payments
                .filter(p => p.statut === 'en_attente')
                .reduce((sum, p) => sum + p.montant, 0) / 100
              const isLoading = loadingId === s.id

              return (
                <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white">{beat?.beatmakers?.nom_artiste ?? 'Beatmaker'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        Beat : <span className="text-gray-300">{beat?.titre ?? '—'}</span>
                      </p>
                      <p className="text-xs text-indigo-400 font-medium">
                        Split proposé : {s.pourcentage}%
                      </p>
                      {montantEnAttente > 0 && (
                        <p className="text-xs text-amber-400 font-medium mt-1">
                          {montantEnAttente.toFixed(2)}€ en attente de récupération
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => accepter(s.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                      >
                        {isLoading ? '...' : 'Accepter'}
                      </button>
                      <button
                        onClick={() => refuser(s.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 text-xs transition-colors"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Refusées ── */}
      {onglet === 'refusees' && (
        <div className="flex flex-col gap-3">
          {refusees.length === 0 ? (
            <div className="text-center py-16 text-xs text-gray-700">Aucune invitation refusée</div>
          ) : (
            refusees.map(s => {
              const beat = s.beats
              return (
                <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 opacity-60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white">{beat?.beatmakers?.nom_artiste ?? 'Beatmaker'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        Beat : <span className="text-gray-300">{beat?.titre ?? '—'}</span>
                      </p>
                      <p className="text-xs text-gray-600">Split proposé : {s.pourcentage}%</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

    </div>
  )
}
