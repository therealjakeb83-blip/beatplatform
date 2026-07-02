'use client'

import { useEffect, useState } from 'react'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, getGranulariteLabel, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type PrefRow   = { name: string; ca: number; ventes: number }
type HistoPoint = { label: string; fullLabel: string; ca: number; ventes: number }
type Data = {
  licences:    PrefRow[]
  styles:      PrefRow[]
  ambiances:   PrefRow[]
  instruments: PrefRow[]
  type_beat:   PrefRow[]
  historique: {
    licences:    HistoPoint[]
    styles:      HistoPoint[]
    ambiances:   HistoPoint[]
    instruments: HistoPoint[]
    type_beat:   HistoPoint[]
  }
}

type Vue = 'licences' | 'styles' | 'ambiances' | 'instruments' | 'type_beat'
type Metrique = 'ca' | 'ventes'

const VUES: { key: Vue; label: string }[] = [
  { key: 'licences',    label: 'Licence' },
  { key: 'styles',      label: 'Style' },
  { key: 'ambiances',   label: 'Ambiance' },
  { key: 'type_beat',   label: 'Type beat' },
  { key: 'instruments', label: 'Instrument' },
]

const METRIQUES: { key: Metrique; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'ca',      label: 'CA (brut, TTC)', color: '#4ade80', fmt: v => fmtEuroDisplay(v) },
  { key: 'ventes',  label: 'Ventes',         color: '#8b5cf6', fmt: v => String(v) },
]

export default function TabPreferences({ periode, debut, fin }: Props) {
  const [data,      setData]      = useState<Data | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [vue,       setVue]       = useState<Vue>('licences')
  const [metrique,  setMetrique]  = useState<Metrique>('ca')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/preferences?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  if (loading) return <Skeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const rows = data[vue]
  const hist = data.historique[vue]
  const metConf = METRIQUES.find(m => m.key === metrique) ?? METRIQUES[0]
  const maxVal  = Math.max(...rows.map(r => r[metrique]), 1)

  const totals = rows.reduce((s, r) => ({ ca: s.ca + r.ca, ventes: s.ventes + r.ventes }), { ca: 0, ventes: 0 })

  return (
    <div className="space-y-6">
      {/* Sélecteur de vue */}
      <div className="flex flex-wrap gap-1">
        {VUES.map(v => (
          <button key={v.key} onClick={() => setVue(v.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${vue === v.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* KPIs totaux */}
      <div className="grid grid-cols-2 gap-3">
        {METRIQUES.map(m => (
          <KpiCard
            key={m.key}
            label={m.label}
            value={m.fmt(totals[m.key])}
            color={m.color}
            active={metrique === m.key}
            onClick={() => setMetrique(m.key)}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium mb-3">
          {metConf.label} — {VUES.find(v => v.key === vue)?.label.toLowerCase()} — {getGranulariteLabel(periode, debut, fin)}
        </p>
        <AnalyticsLineChart
          data={hist}
          xKey="label"
          series={[{ key: metrique, color: metConf.color, label: metConf.label }]}
          formatValue={metConf.fmt}
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">
          Par {VUES.find(v => v.key === vue)?.label.toLowerCase()} ({rows.length})
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-2">Catégorie</th>
                <th className="text-right px-4 py-2">CA (TTC)</th>
                <th className="text-right px-4 py-2">Ventes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const pct = maxVal > 0 ? (r[metrique] / maxVal) * 100 : 0
                return (
                  <tr key={r.name} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-white font-medium">{r.name}</p>
                          <div className="mt-1 h-1 bg-gray-800 rounded-full w-24 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: metConf.color }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">{fmtEuroDisplay(r.ca)}</td>
                    <td className="px-4 py-3 text-right text-violet-400">{r.ventes}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-600">Aucune donnée</td></tr>
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
      <div className="flex gap-1">{Array.from({length:5}).map((_,i)=><div key={i} className="h-8 w-24 bg-gray-800 rounded-lg"/>)}</div>
      <div className="grid grid-cols-2 gap-3">{Array.from({length:2}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}</div>
      <div className="h-48 bg-gray-800 rounded-xl"/>
      <div className="h-64 bg-gray-800 rounded-xl"/>
    </div>
  )
}
