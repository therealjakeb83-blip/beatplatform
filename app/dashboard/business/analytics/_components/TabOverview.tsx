'use client'

import { useEffect, useState } from 'react'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, fmtNum, fmtDate, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type Data = {
  kpis: { ca_brut: number; ca_net: number; mrr: number; arr: number; collab_ca: number; panier_moyen: number; beats_vendus: number; ecoutes: number; free_dl: number }
  historique: Array<Record<string, unknown>>
  top_beats: Array<{ id: string; titre: string; couleur: string | null; ca: number; ventes: number }>
  dernieres_licences: Array<{ id: string; beat_titre: string; licence_nom: string; created_at: string; prix_paye: number; reduction_montant: number | null }>
  abonnes: { actifs: number; nouveaux: number; annules: number }
}

type KpiKey = 'ca' | 'ca_net' | 'mrr' | 'collab_ca' | 'panier_moyen' | 'ventes' | 'ecoutes' | 'free_dl'

const KPI_CONFIG: Array<{ key: KpiKey; label: string; color: string; fmt: (v: number) => string }> = [
  { key: 'ca',          label: 'CA Brut',       color: '#4ade80', fmt: v => fmtEuroDisplay(v) },
  { key: 'ca_net',      label: 'CA Net',         color: '#22d3ee', fmt: v => fmtEuroDisplay(v) },
  { key: 'mrr',         label: 'MRR',            color: '#6366f1', fmt: v => fmtEuroDisplay(v) },
  { key: 'collab_ca',   label: 'Ventes collab',  color: '#38bdf8', fmt: v => fmtEuroDisplay(v) },
  { key: 'panier_moyen',label: 'Panier moyen',   color: '#f59e0b', fmt: v => fmtEuroDisplay(v) },
  { key: 'ventes',      label: 'Beats vendus',   color: '#8b5cf6', fmt: v => String(v) },
  { key: 'ecoutes',     label: 'Écoutes',        color: '#818cf8', fmt: v => fmtNum(v) },
  { key: 'free_dl',     label: 'Free DL',        color: '#22d3ee', fmt: v => String(v) },
]

export default function TabOverview({ periode, debut, fin }: Props) {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [kpiActif, setKpiActif] = useState<KpiKey>('ca')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/overview?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  if (loading) return <LoadingSkeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const { kpis, historique, top_beats, dernieres_licences, abonnes } = data
  const kpiConf = KPI_CONFIG.find(k => k.key === kpiActif) ?? KPI_CONFIG[0]

  const maxTopCa = Math.max(...top_beats.map(b => b.ca), 1)

  return (
    <div className="space-y-6">
      {/* KPI grid 4×2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {KPI_CONFIG.map(k => {
          const val = k.key === 'ventes' || k.key === 'ecoutes' || k.key === 'free_dl'
            ? (kpis as Record<string, number>)[k.key === 'ventes' ? 'beats_vendus' : k.key]
            : (kpis as Record<string, number>)[k.key]
          return (
            <KpiCard
              key={k.key}
              label={k.label}
              value={k.fmt(val)}
              color={k.color}
              active={kpiActif === k.key}
              onClick={() => setKpiActif(k.key)}
            />
          )
        })}
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium mb-3">
          {kpiConf.label} — 12 derniers mois
        </p>
        <AnalyticsLineChart
          data={historique}
          xKey="label"
          series={[{ key: kpiActif === 'ventes' ? 'ventes' : kpiActif, color: kpiConf.color, label: kpiConf.label }]}
          formatValue={kpiConf.fmt}
        />
      </div>

      {/* Bottom: Top beats + Dernières licences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 beats */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">Top 5 beats</p>
          <div className="divide-y divide-gray-800/50">
            {top_beats.length === 0 && (
              <p className="px-4 py-6 text-center text-gray-600 text-xs">Aucune vente</p>
            )}
            {top_beats.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: b.couleur ?? '#6366f1' }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{b.titre}</p>
                  <p className="text-[10px] text-gray-500">{b.ventes} vente{b.ventes > 1 ? 's' : ''}</p>
                </div>
                <p className="text-sm font-bold text-green-400 flex-shrink-0">{fmtEuroDisplay(b.ca)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dernières licences */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">Dernières licences vendues</p>
          <div className="divide-y divide-gray-800/50">
            {dernieres_licences.length === 0 && (
              <p className="px-4 py-6 text-center text-gray-600 text-xs">Aucune licence vendue</p>
            )}
            {dernieres_licences.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{l.beat_titre}</p>
                  <p className="text-[10px] text-gray-500">{l.licence_nom} · {fmtDate(l.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-green-400">{fmtEuroDisplay(l.prix_paye)}</p>
                  {l.reduction_montant ? <p className="text-[10px] text-gray-600">−{fmtEuroDisplay(l.reduction_montant)}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Abonnés panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-3">Abonnés</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-indigo-400">{abonnes.actifs}</p>
            <p className="text-[10px] uppercase text-gray-500 mt-0.5">Actifs</p>
          </div>
          <div>
            <p className="text-2xl font-black text-green-400">+{abonnes.nouveaux}</p>
            <p className="text-[10px] uppercase text-gray-500 mt-0.5">Ce mois</p>
          </div>
          <div>
            <p className="text-2xl font-black text-red-400">{abonnes.annules}</p>
            <p className="text-[10px] uppercase text-gray-500 mt-0.5">Annulés ce mois</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-gray-800 rounded-xl" />)}
      </div>
      <div className="h-52 bg-gray-800 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-gray-800 rounded-xl" />
        <div className="h-48 bg-gray-800 rounded-xl" />
      </div>
      <div className="h-24 bg-gray-800 rounded-xl" />
    </div>
  )
}
