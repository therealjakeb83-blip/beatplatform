'use client'

import { useEffect, useState } from 'react'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type Data = {
  kpis: { ventes_brutes: number; ca_promo: number; remises_total: number; ventes_nettes: number; tva: number; avg_par_jour: number; avg_par_semaine: number; avg_par_mois: number; avg_par_trimestre: number; avg_par_an: number }
  jours: Array<{ date: string; nb: number; brut: number; remises: number; net: number; tva: number }>
  historique: Array<Record<string, unknown>>
}

type KpiKey = 'brut' | 'net' | 'tva'
const KPI_CONFIG: Array<{ key: KpiKey; label: string; color: string }> = [
  { key: 'brut', label: 'Ventes brutes', color: '#4ade80' },
  { key: 'net',  label: 'Ventes nettes', color: '#22d3ee' },
  { key: 'tva',  label: 'TVA',           color: '#f59e0b' },
]

function fmtJourDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function TabRevenus({ periode, debut, fin }: Props) {
  const [data,     setData]    = useState<Data | null>(null)
  const [loading,  setLoading] = useState(true)
  const [kpiActif, setKpiActif] = useState<KpiKey>('brut')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/revenus?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  if (loading) return <Skeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const { kpis, jours, historique } = data
  const kpiConf = KPI_CONFIG.find(k => k.key === kpiActif) ?? KPI_CONFIG[0]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          label="Ventes brutes"
          value={fmtEuroDisplay(kpis.ventes_brutes)}
          color="#4ade80"
          active={kpiActif === 'brut'}
          onClick={() => setKpiActif('brut')}
        />
        <KpiCard
          label="CA via codes promo"
          value={fmtEuroDisplay(kpis.ca_promo)}
          sub={`Remises : −${fmtEuroDisplay(kpis.remises_total)}`}
          color="#f87171"
        />
        <KpiCard
          label="Ventes nettes"
          value={fmtEuroDisplay(kpis.ventes_nettes)}
          sub={kpis.ventes_brutes > 0 ? `${((kpis.ventes_nettes / kpis.ventes_brutes) * 100).toFixed(0)}% du brut` : undefined}
          color="#22d3ee"
          active={kpiActif === 'net'}
          onClick={() => setKpiActif('net')}
        />
        <KpiCard
          label="TVA collectée"
          value={fmtEuroDisplay(kpis.tva)}
          sub="20% TTC inclus"
          color="#f59e0b"
          active={kpiActif === 'tva'}
          onClick={() => setKpiActif('tva')}
        />
        {/* Carte CA moyen */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">CA Moyen</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: 'Par jour',      val: kpis.avg_par_jour },
              { label: 'Par semaine',   val: kpis.avg_par_semaine },
              { label: 'Par mois',      val: kpis.avg_par_mois },
              { label: 'Par trimestre', val: kpis.avg_par_trimestre },
              { label: 'Par an',        val: kpis.avg_par_an },
            ].map(item => (
              <div key={item.label}>
                <p className="text-sm font-bold text-white">{fmtEuroDisplay(item.val)}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium mb-3">{kpiConf.label} — 12 mois</p>
        <AnalyticsLineChart
          data={historique}
          xKey="label"
          series={[{ key: kpiConf.key, color: kpiConf.color, label: kpiConf.label }]}
          formatValue={v => fmtEuroDisplay(v)}
        />
      </div>

      {/* Table journalière */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">Détail journalier</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-right px-4 py-2">Commandes</th>
                <th className="text-right px-4 py-2">Ventes brutes</th>
                <th className="text-right px-4 py-2">Codes promo</th>
                <th className="text-right px-4 py-2">Ventes nettes</th>
                <th className="text-right px-4 py-2">TVA (20%)</th>
              </tr>
            </thead>
            <tbody>
              {jours.map(j => (
                <tr key={j.date} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-gray-300">{fmtJourDate(j.date)}</td>
                  <td className="px-4 py-2.5 text-center text-gray-400">{j.nb}</td>
                  <td className="px-4 py-2.5 text-right text-green-400 font-medium">{fmtEuroDisplay(j.brut)}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">{j.remises > 0 ? `−${fmtEuroDisplay(j.remises)}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-cyan-400 font-medium">{fmtEuroDisplay(j.net)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-400">{j.tva > 0 ? fmtEuroDisplay(j.tva) : '—'}</td>
                </tr>
              ))}
              {jours.length === 0 && (
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}<div className="col-span-2 h-20 bg-gray-800 rounded-xl"/></div>
      <div className="h-48 bg-gray-800 rounded-xl"/>
      <div className="h-72 bg-gray-800 rounded-xl"/>
    </div>
  )
}
