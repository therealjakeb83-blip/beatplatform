'use client'

import { useEffect, useState } from 'react'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, fmtNum, getGranulariteLabel, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type PrefRow    = { name: string; ca: number; ventes: number; ecoutes: number; favoris: number; free_dl: number }
type HistoPoint = { label: string; fullLabel: string; ca: number; ventes: number; ecoutes: number; favoris: number; free_dl: number }
type VueHisto   = { total: HistoPoint[]; parCategorie: Record<string, HistoPoint[]> }
type Data = {
  licences:    PrefRow[]
  styles:      PrefRow[]
  ambiances:   PrefRow[]
  instruments: PrefRow[]
  type_beat:   PrefRow[]
  historique: {
    licences:    VueHisto
    styles:      VueHisto
    ambiances:   VueHisto
    instruments: VueHisto
    type_beat:   VueHisto
  }
}

type Vue = 'licences' | 'styles' | 'ambiances' | 'instruments' | 'type_beat'
type Metrique = 'ca' | 'ventes' | 'ecoutes' | 'favoris' | 'free_dl'

const VUES: { key: Vue; label: string }[] = [
  { key: 'licences',    label: 'Licence' },
  { key: 'styles',      label: 'Style' },
  { key: 'ambiances',   label: 'Ambiance' },
  { key: 'type_beat',   label: 'Type beat' },
  { key: 'instruments', label: 'Instrument' },
]

// Écoutes / Favoris / Free DL sont des métriques au niveau du beat — non applicables à la vue Licences
// (un beat peut avoir plusieurs licences, donc pas d'attribution possible)
const METRIQUES_ALL: { key: Metrique; label: string; color: string; fmt: (v: number) => string; beatOnly?: boolean }[] = [
  { key: 'ca',      label: 'CA (brut, TTC)', color: '#4ade80', fmt: v => fmtEuroDisplay(v) },
  { key: 'ventes',  label: 'Ventes',         color: '#8b5cf6', fmt: v => String(v) },
  { key: 'ecoutes', label: 'Écoutes',        color: '#818cf8', fmt: v => fmtNum(v), beatOnly: true },
  { key: 'favoris', label: 'Favoris',        color: '#f59e0b', fmt: v => String(v), beatOnly: true },
  { key: 'free_dl', label: 'Free DL',        color: '#38bdf8', fmt: v => String(v), beatOnly: true },
]

function metriquesForVue(vue: Vue) {
  return vue === 'licences' ? METRIQUES_ALL.filter(m => !m.beatOnly) : METRIQUES_ALL
}

export default function TabPreferences({ periode, debut, fin }: Props) {
  const [data,      setData]      = useState<Data | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [vue,       setVue]       = useState<Vue>('licences')
  const [metrique,  setMetrique]  = useState<Metrique>('ca')
  const [categorie, setCategorie] = useState<string | null>(null) // null = total toutes catégories

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/preferences?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  if (loading) return <Skeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const rows      = data[vue]
  const vueHisto  = data.historique[vue]
  const histData  = categorie ? (vueHisto.parCategorie[categorie] ?? vueHisto.total) : vueHisto.total
  const metriques = metriquesForVue(vue)
  const metActif  = metriques.find(m => m.key === metrique) ?? metriques[0]

  function changeVue(v: Vue) {
    setVue(v)
    setCategorie(null)
    if (!metriquesForVue(v).some(m => m.key === metrique)) setMetrique('ca')
  }

  function toggleCategorie(name: string) {
    setCategorie(prev => prev === name ? null : name)
  }

  const maxVal = Math.max(...rows.map(r => r[metActif.key]), 1)

  const totals = rows.reduce((s, r) => ({
    ca: s.ca + r.ca, ventes: s.ventes + r.ventes,
    ecoutes: s.ecoutes + r.ecoutes, favoris: s.favoris + r.favoris, free_dl: s.free_dl + r.free_dl,
  }), { ca: 0, ventes: 0, ecoutes: 0, favoris: 0, free_dl: 0 })

  return (
    <div className="space-y-6">
      {/* Sélecteur de vue */}
      <div className="flex flex-wrap gap-1">
        {VUES.map(v => (
          <button key={v.key} onClick={() => changeVue(v.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${vue === v.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* KPIs totaux */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metriques.map(m => (
          <KpiCard
            key={m.key}
            label={m.label}
            value={m.fmt(totals[m.key])}
            color={m.color}
            active={metActif.key === m.key}
            onClick={() => setMetrique(m.key)}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-xs text-gray-400 font-medium">
            {metActif.label} — {categorie ?? `Total ${VUES.find(v => v.key === vue)?.label.toLowerCase()}`} — {getGranulariteLabel(periode, debut, fin)}
          </p>
          <select
            value={categorie ?? '__total__'}
            onChange={e => setCategorie(e.target.value === '__total__' ? null : e.target.value)}
            className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="__total__">Total ({rows.length} {VUES.find(v => v.key === vue)?.label.toLowerCase()}{rows.length > 1 ? 's' : ''})</option>
            {rows.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>
        <AnalyticsLineChart
          data={histData}
          xKey="label"
          series={[{ key: metActif.key, color: metActif.color, label: metActif.label }]}
          formatValue={metActif.fmt}
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
                {vue !== 'licences' && <>
                  <th className="text-right px-4 py-2">Écoutes</th>
                  <th className="text-right px-4 py-2">Favoris</th>
                  <th className="text-right px-4 py-2">Free DL</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const pct    = maxVal > 0 ? (r[metActif.key] / maxVal) * 100 : 0
                const actif  = categorie === r.name
                return (
                  <tr
                    key={r.name}
                    onClick={() => toggleCategorie(r.name)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors ${actif ? 'bg-indigo-950/40' : 'hover:bg-gray-800/30'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className={`font-medium ${actif ? 'text-indigo-300' : 'text-white'}`}>{r.name}</p>
                          <div className="mt-1 h-1 bg-gray-800 rounded-full w-24 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: metActif.color }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">{fmtEuroDisplay(r.ca)}</td>
                    <td className="px-4 py-3 text-right text-violet-400">{r.ventes}</td>
                    {vue !== 'licences' && <>
                      <td className="px-4 py-3 text-right text-indigo-300">{fmtNum(r.ecoutes)}</td>
                      <td className="px-4 py-3 text-right text-amber-400">{r.favoris}</td>
                      <td className="px-4 py-3 text-right text-sky-400">{r.free_dl}</td>
                    </>}
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={vue === 'licences' ? 3 : 6} className="px-4 py-8 text-center text-gray-600">Aucune donnée</td></tr>
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}</div>
      <div className="h-48 bg-gray-800 rounded-xl"/>
      <div className="h-64 bg-gray-800 rounded-xl"/>
    </div>
  )
}
