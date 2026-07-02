'use client'

import { useEffect, useState } from 'react'
import Link               from 'next/link'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import MiniBar            from './MiniBar'
import { periodeToSearch, fmtEuroDisplay, getGranulariteLabel, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type Code = {
  id: string; code: string; description: string | null; type_valeur: string; valeur: number
  utilisations: number; remise_total: number; ca_brut: number; ca_net: number; statut: string
}

type Data = {
  kpis: { utilisations: number; remises_total: number; ca_brut: number; ca_net: number; actifs: number }
  historique: Array<Record<string, unknown>>
  codes: Code[]
}

type KpiKey = 'utilisations' | 'remises' | 'ca_brut' | 'ca_net' | 'actifs'
const STATUT_STYLE: Record<string, string> = {
  actif:   'bg-green-500/15 text-green-400 border border-green-500/20',
  inactif: 'bg-gray-700     text-gray-400  border border-gray-600',
  expire:  'bg-red-500/15   text-red-400   border border-red-500/20',
}

function labelTypeValeur(t: string): string {
  return t === 'pourcentage' ? 'Pourcentage' : 'Montant fixe'
}

export default function TabCodesPromo({ periode, debut, fin }: Props) {
  const [data,     setData]    = useState<Data | null>(null)
  const [loading,  setLoading] = useState(true)
  const [kpiActif, setKpiActif] = useState<KpiKey>('ca_brut')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/business/analytics/codes-promo?${periodeToSearch(periode, debut, fin)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periode, debut, fin])

  if (loading) return <Skeleton />
  if (!data)   return <p className="text-gray-500 text-sm">Erreur de chargement.</p>

  const { kpis, historique, codes } = data
  const maxCaBrut = Math.max(...codes.map(c => c.ca_brut), 1)
  const maxCaNet  = Math.max(...codes.map(c => c.ca_net), 1)

  const chartConfig: Record<KpiKey, { key: string; color: string; label: string; fmt: (v: number) => string }> = {
    utilisations: { key: 'utilisations', color: '#8b5cf6', label: 'Utilisations',    fmt: v => String(Math.round(v)) },
    remises:      { key: 'remises',      color: '#f87171', label: 'Remises',         fmt: v => fmtEuroDisplay(v) },
    ca_brut:      { key: 'ca_brut',      color: '#4ade80', label: 'CA brut (TTC)',   fmt: v => fmtEuroDisplay(v) },
    ca_net:       { key: 'ca_net',       color: '#22d3ee', label: 'CA net (HT)',     fmt: v => fmtEuroDisplay(v) },
    actifs:       { key: 'actifs',       color: '#6366f1', label: 'Codes actifs',    fmt: v => String(Math.round(v)) },
  }
  const conf = chartConfig[kpiActif]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Utilisations"      value={String(kpis.utilisations)} color="#8b5cf6"  active={kpiActif === 'utilisations'} onClick={() => setKpiActif('utilisations')} />
        <KpiCard label="Remises accordées" value={fmtEuroDisplay(kpis.remises_total)} color="#f87171" active={kpiActif === 'remises'} onClick={() => setKpiActif('remises')} />
        <KpiCard
          label="CA brut (TTC)"
          value={fmtEuroDisplay(kpis.ca_brut)}
          color="#4ade80"
          active={kpiActif === 'ca_brut'}
          onClick={() => setKpiActif('ca_brut')}
        />
        <KpiCard
          label="CA net (HT)"
          value={fmtEuroDisplay(kpis.ca_net)}
          sub={kpis.ca_brut > 0 ? `${((kpis.ca_net / kpis.ca_brut) * 100).toFixed(0)}% du brut TTC` : undefined}
          color="#22d3ee"
          active={kpiActif === 'ca_net'}
          onClick={() => setKpiActif('ca_net')}
        />
        <KpiCard label="Codes actifs"      value={String(kpis.actifs)}              color="#6366f1" active={kpiActif === 'actifs'}  onClick={() => setKpiActif('actifs')} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-medium mb-3">{conf.label} — {getGranulariteLabel(periode, debut, fin)}</p>
        <AnalyticsLineChart data={historique} xKey="label" series={[{ key: conf.key, color: conf.color, label: conf.label }]} formatValue={conf.fmt} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">Codes promo ({codes.length})</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-2">Code</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Remise</th>
                <th className="text-right px-4 py-2">Utilisations</th>
                <th className="text-right px-4 py-2">Remises accordées</th>
                <th className="text-right px-4 py-2">CA brut (TTC)</th>
                <th className="text-right px-4 py-2">CA net (HT)</th>
                <th className="text-left px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/business/codes-promo/${c.id}`} className="font-mono text-white font-semibold hover:text-indigo-400 transition-colors">
                      {c.code}
                    </Link>
                    {c.description && <p className="text-[10px] text-gray-500">{c.description}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {labelTypeValeur(c.type_valeur)}
                  </td>
                  <td className="px-4 py-2.5 text-amber-400">
                    {c.type_valeur === 'pourcentage' ? `${c.valeur}%` : fmtEuroDisplay(c.valeur)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-300">{c.utilisations}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">
                    {c.remise_total > 0 ? `−${fmtEuroDisplay(c.remise_total)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-green-400 font-medium">{fmtEuroDisplay(c.ca_brut)}</span>
                      <MiniBar value={c.ca_brut} max={maxCaBrut} color="#4ade80" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-cyan-400 font-medium">{fmtEuroDisplay(c.ca_net)}</span>
                      <MiniBar value={c.ca_net} max={maxCaNet} color="#22d3ee" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUT_STYLE[c.statut] ?? STATUT_STYLE.inactif}`}>
                      {c.statut}
                    </span>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">Aucun code promo utilisé sur cette période</td></tr>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}</div>
      <div className="h-48 bg-gray-800 rounded-xl"/>
      <div className="h-64 bg-gray-800 rounded-xl"/>
    </div>
  )
}
