'use client'

import { useEffect, useState, useMemo } from 'react'
import Link               from 'next/link'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import MiniBar            from './MiniBar'
import { periodeToSearch, fmtEuroDisplay, fmtNum, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type BeatRow = {
  id: string; titre: string; couleur: string | null; styles: string[]
  ca: number; ventes: number; ecoutes: number; free_dl: number
}

type Data = {
  kpis: { ca_moy_par_beat: number; cmdes_moy_par_beat: number; ecoutes: number; free_dl: number }
  historique: Array<Record<string, unknown>>
  beats: BeatRow[]
}

type SortKey = 'ca' | 'ventes' | 'ecoutes' | 'free_dl'
type KpiKey  = 'ca' | 'ventes' | 'ecoutes' | 'free_dl'

const KPI_CONFIG: Array<{ key: KpiKey; label: string; color: string; fmt: (v: number) => string }> = [
  { key: 'ca',      label: 'CA',       color: '#4ade80', fmt: v => fmtEuroDisplay(v) },
  { key: 'ventes',  label: 'Ventes',   color: '#8b5cf6', fmt: v => String(Math.round(v)) },
  { key: 'ecoutes', label: 'Écoutes',  color: '#818cf8', fmt: v => fmtNum(Math.round(v)) },
  { key: 'free_dl', label: 'Free DL',  color: '#38bdf8', fmt: v => String(Math.round(v)) },
]

export default function TabBeats({ periode, debut, fin }: Props) {
  const [data,     setData]    = useState<Data | null>(null)
  const [loading,  setLoading] = useState(true)
  const [kpiActif, setKpiActif] = useState<KpiKey>('ca')
  const [sort,     setSort]    = useState<{ key: SortKey; asc: boolean }>({ key: 'ca', asc: false })
  const [search,   setSearch]  = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/beats?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  const rows = useMemo(() => {
    if (!data) return []
    let r = data.beats
    if (search) r = r.filter(b => b.titre.toLowerCase().includes(search.toLowerCase()) || b.styles.some(s => s.toLowerCase().includes(search.toLowerCase())))
    return [...r].sort((a, b) => {
      const diff = (a[sort.key] as number) - (b[sort.key] as number)
      return sort.asc ? diff : -diff
    })
  }, [data, sort, search])

  if (loading) return <Skeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const { kpis, historique } = data
  const kpiConf = KPI_CONFIG.find(k => k.key === kpiActif) ?? KPI_CONFIG[0]
  const maxCa   = Math.max(...rows.map(b => b.ca), 1)
  const maxEcoutes = Math.max(...rows.map(b => b.ecoutes), 1)
  const maxDl   = Math.max(...rows.map(b => b.free_dl), 1)

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, asc: !s.asc } : { key, asc: false })
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <span className="text-gray-700">↕</span>
    return <span className="text-indigo-400">{sort.asc ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="CA moy. / beat"    value={fmtEuroDisplay(kpis.ca_moy_par_beat)}     color="#4ade80" active={kpiActif === 'ca'}      onClick={() => setKpiActif('ca')} />
        <KpiCard label="Cmdes moy. / beat" value={kpis.cmdes_moy_par_beat.toFixed(1)}       color="#8b5cf6" active={kpiActif === 'ventes'}  onClick={() => setKpiActif('ventes')} />
        <KpiCard label="Écoutes"           value={fmtNum(kpis.ecoutes)}                     color="#818cf8" active={kpiActif === 'ecoutes'} onClick={() => setKpiActif('ecoutes')} />
        <KpiCard label="Free DL"           value={String(kpis.free_dl)}                     color="#38bdf8" active={kpiActif === 'free_dl'} onClick={() => setKpiActif('free_dl')} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium mb-3">{kpiConf.label} — 12 mois</p>
        <AnalyticsLineChart data={historique} xKey="label" series={[{ key: kpiConf.key, color: kpiConf.color, label: kpiConf.label }]} formatValue={kpiConf.fmt} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-white">Beats ({rows.length})</p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-2">Beat</th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => toggleSort('ca')}>CA <SortIcon k="ca" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => toggleSort('ventes')}>Ventes <SortIcon k="ventes" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => toggleSort('ecoutes')}>Écoutes <SortIcon k="ecoutes" /></th>
                <th className="text-right px-4 py-2 cursor-pointer select-none" onClick={() => toggleSort('free_dl')}>Free DL <SortIcon k="free_dl" /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(b => (
                <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/business/analytics/beats/${b.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: b.couleur ?? '#6366f1' }}>
                        {b.titre.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{b.titre}</p>
                        {b.styles.length > 0 && <p className="text-[10px] text-gray-500">{b.styles[0]}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-right">
                      <span className="text-green-400 font-medium">{fmtEuroDisplay(b.ca)}</span>
                      <MiniBar value={b.ca} max={maxCa} color="#4ade80" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-violet-400">{b.ventes}</td>
                  <td className="px-4 py-3">
                    <div className="text-right">
                      <span className="text-indigo-300">{fmtNum(b.ecoutes)}</span>
                      <MiniBar value={b.ecoutes} max={maxEcoutes} color="#818cf8" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-right">
                      <span className="text-sky-400">{b.free_dl}</span>
                      <MiniBar value={b.free_dl} max={maxDl} color="#38bdf8" />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Aucun beat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}</div>
      <div className="h-48 bg-gray-800 rounded-xl"/>
      <div className="h-72 bg-gray-800 rounded-xl"/>
    </div>
  )
}
