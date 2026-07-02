'use client'

import { useEffect, useState } from 'react'
import Link              from 'next/link'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, getGranulariteLabel, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type Abonne = {
  id: string; client_id: string | null; client_nom: string; pays: string | null
  date_debut: string; date_fin: string | null; mois_anciennete: number
  beats_offerts: number; statut: string; prix: number; ltv: number; achats_post_abo: number
}

type Data = {
  kpis: { mrr: number; arr: number; actifs: number; en_annulation: number; total_vendus: number; retention_moy: number; churn_rate: number; churn_count: number; achats_post_abo: number }
  historique: Array<Record<string, unknown>>
  abonnes: Abonne[]
}

type KpiKey = 'mrr' | 'actifs'
const STATUT_STYLE: Record<string, string> = {
  actif:      'bg-green-500/15 text-green-400 border border-green-500/20',
  annulation: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  impaye:     'bg-red-500/15   text-red-400   border border-red-500/20',
  annule:     'bg-gray-700     text-gray-400  border border-gray-600',
}
const STATUT_LABEL: Record<string, string> = {
  actif: 'Actif', annulation: 'En annulation', impaye: 'Impayé', annule: 'Annulé',
}

export default function TabAbonnements({ periode, debut, fin }: Props) {
  const [data,     setData]    = useState<Data | null>(null)
  const [loading,  setLoading] = useState(true)
  const [kpiActif, setKpiActif] = useState<KpiKey>('mrr')
  const [search,   setSearch]  = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/abonnements?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  if (loading) return <Skeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const { kpis, historique, abonnes } = data
  const filtered = abonnes.filter(a => !search || a.client_nom.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="MRR" value={fmtEuroDisplay(kpis.mrr)} sub={`ARR : ${fmtEuroDisplay(kpis.arr)}`} color="#6366f1" active={kpiActif === 'mrr'} onClick={() => setKpiActif('mrr')} />
        <KpiCard label="Abonnés actifs" value={String(kpis.actifs)} sub={kpis.en_annulation > 0 ? `${kpis.en_annulation} en annulation` : undefined} color="#4ade80" active={kpiActif === 'actifs'} onClick={() => setKpiActif('actifs')} />
        <KpiCard label="Total vendus" value={String(kpis.total_vendus)} color="#8b5cf6" />
        <KpiCard label="Rétention moy." value={`${kpis.retention_moy.toFixed(1)} mois`} color="#f59e0b" />
        <KpiCard label="Achats post-abo" value={kpis.achats_post_abo.toFixed(1)} sub="licences / abonné" color="#38bdf8" />
        <KpiCard label="Churn" value={String(kpis.churn_count)} sub={`${kpis.churn_rate.toFixed(1)}% churn rate`} color="#f87171" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium mb-3">
          {kpiActif === 'mrr' ? 'MRR' : 'Abonnés actifs'} — {getGranulariteLabel(periode, debut, fin)}
        </p>
        <AnalyticsLineChart
          data={historique}
          xKey="label"
          series={[kpiActif === 'mrr'
            ? { key: 'mrr',    color: '#6366f1', label: 'MRR' }
            : { key: 'actifs', color: '#4ade80', label: 'Abonnés actifs' }]}
          formatValue={kpiActif === 'mrr' ? v => fmtEuroDisplay(v) : v => String(Math.round(v))}
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-xs font-semibold text-white">Abonnés ({filtered.length})</p>
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
                <th className="text-left px-4 py-2">N° Abo</th>
                <th className="text-left px-4 py-2">Abonné</th>
                <th className="text-right px-4 py-2">Ancienneté</th>
                <th className="text-right px-4 py-2">Achats post-abo</th>
                <th className="text-right px-4 py-2">Beats offerts</th>
                <th className="text-right px-4 py-2">LTV abo</th>
                <th className="text-left px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/business/abonnements/${a.id}`} className="font-mono text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
                      #{a.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {a.client_id
                      ? <Link href={`/dashboard/business/contacts/${a.client_id}`} className="text-white hover:text-indigo-300 transition-colors">{a.client_nom}</Link>
                      : <span className="text-gray-400">{a.client_nom}</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{a.mois_anciennete} mois</td>
                  <td className="px-4 py-2.5 text-right text-indigo-400">{a.achats_post_abo}</td>
                  <td className="px-4 py-2.5 text-right">
                    {a.beats_offerts > 0
                      ? <span className="text-violet-400 font-medium">{a.beats_offerts}</span>
                      : <span className="text-gray-700">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right text-green-400 font-medium">{fmtEuroDisplay(a.ltv)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUT_STYLE[a.statut] ?? STATUT_STYLE.annule}`}>
                      {STATUT_LABEL[a.statut] ?? a.statut}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Aucun abonné</td></tr>
              )}
            </tbody>
            {abonnes.length > 0 && (
              <tfoot>
                <tr className="bg-gray-900/50 border-t border-gray-800">
                  <td className="px-4 py-2 text-gray-500 text-[10px]" colSpan={2}>Total / Moyenne</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{kpis.retention_moy.toFixed(1)} mois</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{kpis.achats_post_abo.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{abonnes.reduce((s, a) => s + a.beats_offerts, 0)}</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{fmtEuroDisplay(abonnes.reduce((s, a) => s + a.ltv, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
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
