'use client'

import { useEffect, useState } from 'react'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, fmtDate, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type Data = {
  kpis: { ca_brut: number; ca_net: number; panier_moyen: number; beats_vendus: number; collab_ca: number; source_top: { nom: string; ca: number; pct: number } | null }
  historique: Array<Record<string, unknown>>
  commandes: Array<{ id: string; created_at: string; client_nom: string; beat_titre: string; licence_nom: string; source_marketing: string | null; prix_paye: number; reduction_montant: number | null }>
}

const SOURCE_COLORS: Record<string, string> = {
  instagram: '#6366f1', youtube: '#ef4444', google: '#f59e0b', direct: '#4ade80', autre: '#6b7280',
}
const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', youtube: 'YouTube', google: 'Google', direct: 'Direct', autre: 'Autre',
}

export default function TabVentes({ periode, debut, fin }: Props) {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState<'ca' | 'sources'>('ca')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/ventes?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  if (loading) return <Skeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const { kpis, historique, commandes } = data
  const chartSeries = chartMode === 'ca'
    ? [{ key: 'ca', color: '#4ade80', label: 'CA Brut' }]
    : ['instagram', 'youtube', 'google', 'direct', 'autre'].map(s => ({ key: s, color: SOURCE_COLORS[s], label: SOURCE_LABELS[s] }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="CA Brut"       value={fmtEuroDisplay(kpis.ca_brut)}    color="#4ade80" sub={`Net : ${fmtEuroDisplay(kpis.ca_net)}`} />
        <KpiCard label="Panier moyen"  value={fmtEuroDisplay(kpis.panier_moyen)} color="#f59e0b" />
        <KpiCard label="Beats vendus"  value={String(kpis.beats_vendus)}       color="#8b5cf6" />
        <KpiCard label="Ventes collab" value={fmtEuroDisplay(kpis.collab_ca)}  color="#38bdf8" />
        <KpiCard label="CA Net"        value={fmtEuroDisplay(kpis.ca_net)}     color="#22d3ee" />
        {kpis.source_top
          ? <KpiCard label={`Source #1 — ${kpis.source_top.nom}`} value={fmtEuroDisplay(kpis.source_top.ca)} sub={`${kpis.source_top.pct.toFixed(0)}% du CA`} color="#a78bfa" />
          : <KpiCard label="Source #1" value="—" />}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400 font-medium">Évolution 12 mois</p>
          <div className="flex gap-1">
            <button onClick={() => setChartMode('ca')}      className={`px-2 py-1 rounded text-[10px] ${chartMode === 'ca'      ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>CA global</button>
            <button onClick={() => setChartMode('sources')} className={`px-2 py-1 rounded text-[10px] ${chartMode === 'sources' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Par source</button>
          </div>
        </div>
        <AnalyticsLineChart data={historique} xKey="label" series={chartSeries} formatValue={v => fmtEuroDisplay(v)} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">Commandes ({commandes.length})</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-left px-4 py-2">Beat</th>
                <th className="text-left px-4 py-2">Licence</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-right px-4 py-2">Montant</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map(c => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-white font-medium">{c.client_nom}</td>
                  <td className="px-4 py-2.5 text-gray-300 max-w-[140px] truncate">{c.beat_titre}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">{c.licence_nom}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{SOURCE_LABELS[c.source_marketing ?? 'direct'] ?? 'Direct'}</td>
                  <td className="px-4 py-2.5 text-gray-400">{fmtDate(c.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-green-400 font-medium">{fmtEuroDisplay(c.prix_paye)}</span>
                    {c.reduction_montant ? <span className="text-gray-600 ml-1 text-[10px]">−{fmtEuroDisplay(c.reduction_montant)}</span> : null}
                  </td>
                </tr>
              ))}
              {commandes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Aucune vente sur cette période</td></tr>
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}</div>
      <div className="h-48 bg-gray-800 rounded-xl"/>
      <div className="h-72 bg-gray-800 rounded-xl"/>
    </div>
  )
}
