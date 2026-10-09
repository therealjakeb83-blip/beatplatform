'use client'

import { useEffect, useState } from 'react'
import Link                   from 'next/link'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, fmtDate, getGranulariteLabel, type Periode } from '../_lib/periode'
import { SOURCE_COLORS, SOURCE_LABELS, SOURCES_MARKETING } from '@/lib/sources-marketing'

type Props = { periode: Periode; debut: string; fin: string }

type Data = {
  kpis: { ca_brut: number; ca_net: number; panier_moyen: number; beats_vendus: number; source_top: { nom: string; ca: number; pct: number } | null; recu_collab: number; part_collaborateurs: number }
  historique: Array<Record<string, unknown>>
  commandes: Array<{ id: string; created_at: string; client_nom: string; beat_titre: string; nb_articles: number; licence_nom: string; source_marketing: string | null; prix_paye: number; reduction_montant: number | null }>
}

type KpiKey = 'ca_brut' | 'ca_net' | 'panier_moyen' | 'ventes' | 'source_top' | 'recu_collab'

const KPI_CONFIG: Array<{ key: KpiKey; histKey: string; label: string; color: string; fmt: (v: number) => string }> = [
  { key: 'ca_brut',      histKey: 'ca',          label: 'CA Brut (TTC)', color: '#4ade80', fmt: v => fmtEuroDisplay(v) },
  { key: 'ca_net',       histKey: 'ca_net',      label: 'CA Net (HT)',   color: '#22d3ee', fmt: v => fmtEuroDisplay(v) },
  { key: 'panier_moyen', histKey: 'panier_moyen',label: 'Panier moyen',  color: '#f59e0b', fmt: v => fmtEuroDisplay(v) },
  { key: 'ventes',       histKey: 'ventes',      label: 'Beats vendus',  color: '#8b5cf6', fmt: v => String(Math.round(v)) },
  { key: 'recu_collab',  histKey: 'recu_collab', label: 'Collaborations', color: '#38bdf8', fmt: v => fmtEuroDisplay(v) },
]


const ALL_SOURCES = SOURCES_MARKETING

export default function TabVentes({ periode, debut, fin }: Props) {
  const [data,           setData]           = useState<Data | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [kpiActif,       setKpiActif]       = useState<KpiKey>('ca_brut')
  const [parSource,      setParSource]      = useState(false)
  const [sourcesActives, setSourcesActives] = useState<string[]>([...ALL_SOURCES])

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
  const kpiConf = KPI_CONFIG.find(k => k.key === kpiActif) ?? KPI_CONFIG[0]

  const showParSource = (kpiActif === 'ca_brut' && parSource) || kpiActif === 'source_top'
  const chartSeries = showParSource
    ? ALL_SOURCES.filter(s => sourcesActives.includes(s)).map(s => ({ key: s, color: SOURCE_COLORS[s], label: SOURCE_LABELS[s] }))
    : kpiActif === 'recu_collab'
      ? [{ key: 'recu_collab', color: '#38bdf8', label: 'Reçu en collab' }, { key: 'part_collaborateurs', color: '#f472b6', label: 'Part de tes collaborateurs' }]
      : [{ key: kpiConf?.histKey ?? 'ca', color: kpiConf?.color ?? '#4ade80', label: kpiConf?.label ?? 'CA Brut (TTC)' }]

  function handleKpiClick(key: KpiKey) {
    setKpiActif(key)
    if (key !== 'ca_brut') setParSource(false)
  }

  function toggleSource(src: string) {
    setSourcesActives(prev =>
      prev.includes(src)
        ? prev.length > 1 ? prev.filter(s => s !== src) : prev
        : [...prev, src]
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="CA Brut (TTC)" value={fmtEuroDisplay(kpis.ca_brut)}      color="#4ade80" active={kpiActif === 'ca_brut'}      onClick={() => handleKpiClick('ca_brut')} />
        <KpiCard label="CA Net (HT)"   value={fmtEuroDisplay(kpis.ca_net)}       color="#22d3ee" active={kpiActif === 'ca_net'}       onClick={() => handleKpiClick('ca_net')} />
        <KpiCard label="Panier moyen"  value={fmtEuroDisplay(kpis.panier_moyen)} color="#f59e0b" active={kpiActif === 'panier_moyen'} onClick={() => handleKpiClick('panier_moyen')} />
        <KpiCard label="Beats vendus"  value={String(kpis.beats_vendus)}         color="#8b5cf6" active={kpiActif === 'ventes'}       onClick={() => handleKpiClick('ventes')} />
        {kpis.source_top
          ? <KpiCard label={`Source #1 — ${kpis.source_top.nom}`} value={fmtEuroDisplay(kpis.source_top.ca)} sub={`${kpis.source_top.pct.toFixed(0)}% du CA`} color="#a78bfa" active={kpiActif === 'source_top'} onClick={() => handleKpiClick('source_top')} />
          : <KpiCard label="Source #1" value="—" />}
        <KpiCard label="Reçu en collab" value={fmtEuroDisplay(kpis.recu_collab)} sub={`Part de tes collaborateurs : ${fmtEuroDisplay(kpis.part_collaborateurs)}`} color="#38bdf8" active={kpiActif === 'recu_collab'} onClick={() => handleKpiClick('recu_collab')} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400 font-medium">{kpiActif === 'source_top' ? 'Par source' : kpiConf?.label ?? 'CA Brut (TTC)'} — {getGranulariteLabel(periode, debut, fin)}</p>
          {kpiActif === 'ca_brut' && (
            <div className="flex gap-1">
              <button onClick={() => setParSource(false)} className={`px-2 py-1 rounded text-[10px] ${!parSource ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>CA global</button>
              <button onClick={() => setParSource(true)}  className={`px-2 py-1 rounded text-[10px] ${ parSource ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Par source</button>
            </div>
          )}
        </div>
        <AnalyticsLineChart data={historique} xKey="label" series={chartSeries} formatValue={kpiConf?.fmt ?? fmtEuroDisplay} showLegend={!showParSource} />
        {showParSource && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-800">
            {ALL_SOURCES.map(src => {
              const actif = sourcesActives.includes(src)
              return (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-opacity ${actif ? 'opacity-100' : 'opacity-30'}`}
                  style={{ border: `1px solid ${SOURCE_COLORS[src]}22`, background: `${SOURCE_COLORS[src]}15` }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SOURCE_COLORS[src] }} />
                  <span style={{ color: SOURCE_COLORS[src] }}>{SOURCE_LABELS[src]}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">Commandes ({commandes.length})</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-2">N°</th>
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
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/business/commandes/${c.id}`} className="font-mono text-[10px] text-indigo-400 hover:text-indigo-300">
                      #{c.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-white font-medium">{c.client_nom}</td>
                  <td className="px-4 py-2.5 text-gray-300 max-w-[140px] truncate">
                    {c.beat_titre}{c.nb_articles > 1 && <span className="text-gray-500"> +{c.nb_articles - 1}</span>}
                  </td>
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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Aucune vente sur cette période</td></tr>
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
