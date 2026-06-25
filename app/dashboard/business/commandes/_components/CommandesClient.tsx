'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { CommandeRow } from '../page'

/* ─── constants ─────────────────────────────────────────────────── */

const STATUT = {
  en_attente: { label: 'En attente', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' },
  payee:      { label: 'Payée',      cls: 'bg-green-500/15  text-green-400  border border-green-500/20' },
  remboursee: { label: 'Remboursée', cls: 'bg-red-500/15    text-red-400    border border-red-500/20' },
  litige:     { label: 'Litige',     cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' },
} as const

const SOURCE_LABEL: Record<string, string> = {
  youtube: 'YouTube', instagram: 'Instagram', google: 'Google',
  direct: 'Direct', autre: 'Autre',
}

const TABS = [
  { label: 'Toutes',     value: '' },
  { label: 'En attente', value: 'en_attente' },
  { label: 'Payée',      value: 'payee' },
  { label: 'Remboursée', value: 'remboursee' },
  { label: 'Litige',     value: 'litige' },
]

const SCOPES = [
  { value: 'tout',    label: 'Tout' },
  { value: 'numero',  label: 'N° commande' },
  { value: 'email',   label: 'Email' },
  { value: 'client',  label: 'Client' },
  { value: 'beat',    label: 'Beat' },
]

const PERIODES = [
  { value: '7',   label: '7 jours' },
  { value: '30',  label: '30 jours' },
  { value: '90',  label: '3 mois' },
  { value: '180', label: '6 mois' },
  { value: '365', label: '1 an' },
]

/* ─── helpers ────────────────────────────────────────────────────── */

function nomClient(c: CommandeRow): string {
  if (c.clients) return [c.clients.prenom, c.clients.nom].filter(Boolean).join(' ')
  return c.acheteur_nom ?? c.acheteur_email ?? '—'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function FlagImg({ pays }: { pays: string | null | undefined }) {
  if (!pays || pays.length !== 2) return <span className="text-gray-500 text-xs">—</span>
  return (
    <img
      src={`https://flagcdn.com/w40/${pays.toLowerCase()}.png`}
      alt={pays}
      className="w-5 h-3.5 object-cover rounded-sm"
    />
  )
}

/* ─── preview modal ──────────────────────────────────────────────── */

function PreviewModal({ c, onClose }: { c: CommandeRow; onClose: () => void }) {
  const ht  = c.prix_paye / 1.2
  const tva = c.prix_paye - ht
  const remise = c.reduction_montant ?? 0
  const sousTotal = c.prix_paye + remise

  const s = STATUT[c.statut] ?? { label: c.statut, cls: 'bg-gray-700 text-gray-300 border border-gray-600' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-gray-400">
              #{c.id.slice(0, 8).toUpperCase()}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
              {s.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/business/commandes/${c.id}`}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Voir le détail →
            </Link>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Client */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Client</p>
            <div className="flex items-center gap-2">
              <FlagImg pays={c.clients?.pays} />
              <span className="text-sm font-medium text-white">{nomClient(c)}</span>
            </div>
            <p className="text-xs text-gray-400">{c.clients?.email ?? c.acheteur_email ?? '—'}</p>
          </div>

          {/* Produit */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Produit</p>
            {c.beats ? (
              <p className="text-sm text-white">{c.beats.titre}</p>
            ) : (
              <p className="text-sm text-gray-500">—</p>
            )}
            {c.licences && (
              <p className="text-xs text-gray-400">{c.licences.nom} · {c.licences.modele}</p>
            )}
          </div>

          {/* Infos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">Date</p>
              <p className="text-xs text-gray-300">{fmtDate(c.created_at)}</p>
            </div>
            {c.source_marketing && (
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Source</p>
                <p className="text-xs text-gray-300">{SOURCE_LABEL[c.source_marketing] ?? c.source_marketing}</p>
              </div>
            )}
            {c.methode_paiement && (
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Paiement</p>
                <p className="text-xs text-gray-300">{c.methode_paiement}</p>
              </div>
            )}
            {c.code_promo && (
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Code promo</p>
                <p className="text-xs font-mono text-indigo-400">{c.code_promo}</p>
              </div>
            )}
          </div>

          {/* Totaux */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-2">
            {remise > 0 && (
              <>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Sous-total</span>
                  <span>{sousTotal}€</span>
                </div>
                <div className="flex justify-between text-xs text-green-400">
                  <span>Remise ({c.code_promo})</span>
                  <span>−{remise}€</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-xs text-gray-400">
              <span>Total HT</span>
              <span>{ht.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>TVA (20%)</span>
              <span>{tva.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-white pt-2 border-t border-gray-700">
              <span>Total TTC</span>
              <span>{Number(c.prix_paye).toFixed(2)}€</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── main component ─────────────────────────────────────────────── */

type Props = {
  commandes: CommandeRow[]
  initialClientId?: string
  initialType?: string
}

export default function CommandesClient({ commandes, initialClientId, initialType }: Props) {
  const [search, setSearch]             = useState('')
  const [scope, setScope]               = useState('tout')
  const [activeTab, setActiveTab]       = useState('')
  const [filtreSource, setFiltreSource] = useState('')
  const [filtreType, setFiltreType]     = useState(initialType ?? '')
  const [filtrePeriode, setFiltrePeriode] = useState('')
  const [filtreClientId, setFiltreClientId] = useState(initialClientId ?? '')
  const [preview, setPreview]           = useState<CommandeRow | null>(null)

  /* counts (before search/source/type/période but after client filter) */
  const counts = useMemo(() => {
    const base = filtreClientId
      ? commandes.filter(c => c.clients?.id === filtreClientId)
      : commandes
    return {
      '':           base.length,
      en_attente:   base.filter(c => c.statut === 'en_attente').length,
      payee:        base.filter(c => c.statut === 'payee').length,
      remboursee:   base.filter(c => c.statut === 'remboursee').length,
      litige:       base.filter(c => c.statut === 'litige').length,
    } as Record<string, number>
  }, [commandes, filtreClientId])

  /* filtered list */
  const filtered = useMemo(() => {
    let list = commandes

    if (filtreClientId) list = list.filter(c => c.clients?.id === filtreClientId)
    if (activeTab)      list = list.filter(c => c.statut === activeTab)
    if (filtreSource)   list = list.filter(c => c.source_marketing === filtreSource)
    if (filtreType)     list = list.filter(c => c.type_transaction === filtreType)
    if (filtrePeriode) {
      const cutoff = new Date(Date.now() - parseInt(filtrePeriode) * 86_400_000)
      list = list.filter(c => new Date(c.created_at) > cutoff)
    }

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c => {
        const id8    = c.id.slice(0, 8).toUpperCase()
        const email  = (c.clients?.email ?? c.acheteur_email ?? '').toLowerCase()
        const client = nomClient(c).toLowerCase()
        const beat   = (c.beats?.titre ?? '').toLowerCase()
        switch (scope) {
          case 'numero':  return id8.includes(q.toUpperCase())
          case 'email':   return email.includes(q)
          case 'client':  return client.includes(q)
          case 'beat':    return beat.includes(q)
          default:        return id8.includes(q.toUpperCase()) || email.includes(q) || client.includes(q) || beat.includes(q)
        }
      })
    }

    return list
  }, [commandes, search, scope, activeTab, filtreSource, filtreType, filtrePeriode, filtreClientId])

  /* context client banner */
  const clientContext = useMemo(() => {
    if (!filtreClientId) return null
    const c = commandes.find(c => c.clients?.id === filtreClientId)
    return c ? nomClient(c) : null
  }, [commandes, filtreClientId])

  const hasFilters = !!(filtreSource || filtreType || filtrePeriode || search || filtreClientId)

  function clearFilters() {
    setSearch('')
    setFiltreSource('')
    setFiltreType('')
    setFiltrePeriode('')
    setFiltreClientId('')
    setActiveTab('')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Commandes</h1>
            <p className="text-sm text-gray-500 mt-0.5">{commandes.length} commande{commandes.length !== 1 ? 's' : ''} au total</p>
          </div>
        </div>

        {/* Context client banner */}
        {clientContext && (
          <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm text-indigo-300">
              Filtré sur les commandes de <strong>{clientContext}</strong>
            </span>
            <button
              onClick={() => setFiltreClientId('')}
              className="ml-auto text-xs text-indigo-400 hover:text-indigo-200"
            >
              Effacer
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${activeTab === tab.value ? 'text-gray-400' : 'text-gray-600'}`}>
                {counts[tab.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-0 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <select
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="bg-gray-800 text-xs text-gray-400 px-3 py-2 border-r border-gray-700 outline-none cursor-pointer"
            >
              {SCOPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="flex items-center px-3 py-2 gap-2 flex-1 min-w-[220px]">
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="bg-transparent text-sm text-white placeholder-gray-600 outline-none flex-1"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
              )}
            </div>
          </div>

          {/* Filters */}
          <select
            value={filtreSource}
            onChange={e => setFiltreSource(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-sm text-gray-400 px-3 py-2 rounded-xl outline-none cursor-pointer"
          >
            <option value="">Source</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filtreType}
            onChange={e => setFiltreType(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-sm text-gray-400 px-3 py-2 rounded-xl outline-none cursor-pointer"
          >
            <option value="">Type</option>
            <option value="achat">Achat</option>
            <option value="upgrade">Upgrade</option>
          </select>

          <select
            value={filtrePeriode}
            onChange={e => setFiltrePeriode(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-sm text-gray-400 px-3 py-2 rounded-xl outline-none cursor-pointer"
          >
            <option value="">Période</option>
            {PERIODES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              Tout effacer
            </button>
          )}

          <span className="ml-auto text-sm text-gray-500">
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-600 text-sm">Aucune commande</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Commande</th>
                    <th className="text-left px-4 py-3">Détails</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">État</th>
                    <th className="text-left px-4 py-3">Code promo</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filtered.map(c => {
                    const s = STATUT[c.statut]
                    const nom = nomClient(c)
                    const pays = c.clients?.pays

                    return (
                      <tr key={c.id} className="hover:bg-gray-800/40 transition-colors group">
                        {/* Commande */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FlagImg pays={pays} />
                            <div>
                              {c.clients ? (
                                <Link
                                  href={`/dashboard/business/contacts/${c.clients.id}`}
                                  className="font-medium text-white hover:text-indigo-300 transition-colors"
                                >
                                  {nom}
                                </Link>
                              ) : (
                                <span className="font-medium text-white">{nom}</span>
                              )}
                              <div>
                                <Link
                                  href={`/dashboard/business/commandes/${c.id}`}
                                  className="font-mono text-xs text-gray-500 hover:text-indigo-400 transition-colors"
                                >
                                  #{c.id.slice(0, 8).toUpperCase()}
                                </Link>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Détails */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPreview(c)}
                              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                              title="Aperçu"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <div>
                              {c.beats && (
                                <p className="text-xs text-gray-400 truncate max-w-[150px]">{c.beats.titre}</p>
                              )}
                              {c.licences && (
                                <p className="text-xs text-gray-600">{c.licences.nom} · {c.licences.modele}</p>
                              )}
                              {c.type_transaction === 'upgrade' && (
                                <span className="text-[10px] text-purple-400 font-medium">↑ Upgrade</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {fmtDate(c.created_at)}
                        </td>

                        {/* État */}
                        <td className="px-4 py-3">
                          {s ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
                              {s.label}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">{c.statut}</span>
                          )}
                        </td>

                        {/* Code promo */}
                        <td className="px-4 py-3">
                          {c.code_promo ? (
                            <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                              {c.code_promo}
                            </span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {c.source_marketing ? SOURCE_LABEL[c.source_marketing] ?? c.source_marketing : '—'}
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                          {Number(c.prix_paye).toFixed(2)}€
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {preview && <PreviewModal c={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
