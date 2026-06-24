'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BeatRow } from '../page'

/* ─── constantes ────────────────────────────────────────────────── */

const STATUT_BADGE: Record<string, string> = {
  public:    'bg-green-500/20 text-green-400',
  prive:     'bg-indigo-500/20 text-indigo-400',
  masque:    'bg-gray-500/20 text-gray-400',
  programme: 'bg-yellow-500/20 text-yellow-400',
  vendu:     'bg-amber-500/20 text-amber-400',
}

const STATUT_LABEL: Record<string, string> = {
  public:    'Public',
  prive:     'Membres',
  masque:    'Masqué',
  programme: 'Programmé',
  vendu:     'Exclusif vendu',
}

const LIC_BADGE: Record<string, string> = {
  mp3:       'bg-sky-500/20 text-sky-400',
  wav:       'bg-indigo-500/20 text-indigo-400',
  stems:     'bg-violet-500/20 text-violet-400',
  illimite:  'bg-pink-500/20 text-pink-400',
  exclusive: 'bg-amber-500/20 text-amber-400',
}

const LIC_LABEL: Record<string, string> = {
  mp3:       'MP3',
  wav:       'WAV',
  stems:     'Stems',
  illimite:  'Illimité',
  exclusive: 'Exclusif',
}

const TABS = [
  { label: 'Tous',           value: '' },
  { label: 'Public',         value: 'public' },
  { label: 'Membres',        value: 'prive' },
  { label: 'Masqué',         value: 'masque' },
  { label: 'Programmé',      value: 'programme' },
  { label: 'Exclusif vendu', value: 'vendu' },
]

type SortKey = 'created_at'

/* ─── helpers ────────────────────────────────────────────────────── */

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-[9px] ${active ? 'text-indigo-400' : 'text-gray-700'}`}>
      {dir === 'asc' ? '▲' : '▼'}
    </span>
  )
}

function Cover({ beat }: { beat: BeatRow }) {
  if (beat.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={beat.image_url} alt={beat.titre} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
    )
  }
  return (
    <div
      className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white/60"
      style={{ backgroundColor: beat.couleur ?? '#374151' }}
    >
      {beat.titre.slice(0, 2).toUpperCase()}
    </div>
  )
}

/* ─── composant ─────────────────────────────────────────────────── */

export default function BeatsClient({ beats }: { beats: BeatRow[] }) {
  const router = useRouter()

  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreGenre,  setFiltreGenre]  = useState('')
  const [search,       setSearch]       = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('created_at')
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc')

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const b of beats) {
      if (b.styles?.[0]) set.add(b.styles[0])
    }
    return [...set].sort()
  }, [beats])

  const counts = useMemo(() => {
    const r: Record<string, number> = { '': beats.length }
    for (const tab of TABS.slice(1)) {
      r[tab.value] = beats.filter(b => b.statut === tab.value).length
    }
    return r
  }, [beats])

  const displayed = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = beats.filter(b => {
      if (filtreStatut && b.statut !== filtreStatut) return false
      if (filtreGenre  && b.styles?.[0] !== filtreGenre) return false
      if (q && !b.titre.toLowerCase().includes(q)) return false
      return true
    })
    return [...filtered].sort((a, b) => {
      const va = new Date(a.created_at).getTime()
      const vb = new Date(b.created_at).getTime()
      return sortDir === 'desc' ? vb - va : va - vb
    })
  }, [beats, filtreStatut, filtreGenre, search, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Beats</h1>
          <p className="text-sm text-gray-500 mt-1">Catalogue et gestion des licences</p>
        </div>
        <Link
          href="/dashboard/beats/nouveau"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Ajouter un beat
        </Link>
      </div>

      {/* Tabs statut */}
      <div className="flex items-center gap-0 mb-5 border-b border-gray-800">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFiltreStatut(tab.value)}
            className={`px-4 py-2.5 text-sm transition-colors relative ${
              filtreStatut === tab.value
                ? 'text-white font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {(counts[tab.value] ?? 0) > 0 && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                filtreStatut === tab.value ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-800 text-gray-500'
              }`}>
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un beat…"
          className="flex-1 bg-gray-900 border border-gray-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
        />
        {genres.length > 0 && (
          <select
            value={filtreGenre}
            onChange={e => setFiltreGenre(e.target.value)}
            className={`bg-gray-900 border rounded-lg px-3 py-2 text-sm outline-none cursor-pointer transition-colors ${
              filtreGenre ? 'border-indigo-500 text-white' : 'border-gray-800 text-gray-400'
            }`}
          >
            <option value="">Tous les styles</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {displayed.length} beat{displayed.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {beats.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-gray-600 mb-4">Aucun beat dans le catalogue.</p>
            <Link
              href="/dashboard/beats/nouveau"
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Ajouter un premier beat →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Beat</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Licences</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  <button onClick={() => handleSort('created_at')} className="hover:text-gray-400 transition-colors">
                    Date <SortIcon active={sortKey === 'created_at'} dir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Statut</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800">
              {displayed.map(b => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/dashboard/beats/${b.id}/modifier`)}
                  className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Cover beat={b} />
                      <div>
                        <p className="text-sm font-semibold text-white">{b.titre}</p>
                        <p className="text-[11px] text-gray-600 mt-0.5">
                          {[b.styles?.[0], b.bpm ? `${b.bpm} BPM` : null, b.cle].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {b.licences.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {b.licences.map(l => (
                          <span
                            key={l}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${LIC_BADGE[l] ?? 'bg-gray-700 text-gray-400'}`}
                          >
                            {LIC_LABEL[l] ?? l}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-700">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {new Date(b.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>

                  <td className="px-5 py-3 text-right">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUT_BADGE[b.statut] ?? 'bg-gray-700 text-gray-400'}`}>
                      {STATUT_LABEL[b.statut] ?? b.statut}
                    </span>
                  </td>
                </tr>
              ))}

              {displayed.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-xs text-gray-700">
                    Aucun beat trouvé
                  </td>
                </tr>
              )}
            </tbody>

            {displayed.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-800 bg-gray-900/50">
                  <td className="px-5 py-3 text-xs text-gray-600 font-semibold" colSpan={4}>
                    {displayed.length} beat{displayed.length > 1 ? 's' : ''}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

    </div>
  )
}
