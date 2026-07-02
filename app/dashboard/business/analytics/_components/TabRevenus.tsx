'use client'

import { useEffect, useState } from 'react'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, getGranulariteLabel, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type MoyValues = { jour: number; semaine: number; mois: number; trimestre: number; an: number }

type Data = {
  kpis: { ventes_brutes: number; remises_total: number; ventes_nettes: number; tva: number; moy_brut: MoyValues; moy_net: MoyValues }
  jours: Array<{ date: string; nb: number; brut: number; remises: number; net: number; tva: number }>
  historique: Array<Record<string, unknown>>
}

type MoyBase = 'net' | 'brut'

type KpiKey = 'brut' | 'remises' | 'net' | 'tva' | 'moy'
const KPI_CONFIG: Array<{ key: 'brut' | 'remises' | 'net' | 'tva'; label: string; color: string }> = [
  { key: 'brut',    label: 'Ventes brutes', color: '#4ade80' },
  { key: 'remises', label: 'Remises',       color: '#f87171' },
  { key: 'net',     label: 'Ventes nettes', color: '#22d3ee' },
  { key: 'tva',     label: 'TVA',           color: '#f59e0b' },
]

type MoyGran = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'an'
const MOY_GRAN: { key: MoyGran; label: string; mult: number }[] = [
  { key: 'jour',      label: 'Par jour',      mult: 1      },
  { key: 'semaine',   label: 'Par semaine',   mult: 7      },
  { key: 'mois',      label: 'Par mois',      mult: 30.44  },
  { key: 'trimestre', label: 'Par trimestre', mult: 91.31  },
  { key: 'an',        label: 'Par an',        mult: 365    },
]

function fmtJourDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtJourShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function TabRevenus({ periode, debut, fin }: Props) {
  const [data,     setData]    = useState<Data | null>(null)
  const [loading,  setLoading] = useState(true)
  const [kpiActif, setKpiActif] = useState<KpiKey>('brut')
  const [moyGran,  setMoyGran]  = useState<MoyGran>('jour')
  const [moyBase,  setMoyBase]  = useState<MoyBase>('net')

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
  const kpiConf   = KPI_CONFIG.find(k => k.key === kpiActif) ?? KPI_CONFIG[0]
  const totCmds   = jours.reduce((s, j) => s + j.nb, 0)
  const moyConf   = MOY_GRAN.find(g => g.key === moyGran)!
  const moyValues = moyBase === 'net' ? kpis.moy_net : kpis.moy_brut

  const moyChartData = [...jours].reverse().reduce<Array<{ label: string; fullLabel: string; valeur: number; cum: number }>>((acc, j) => {
    const cum = (acc.length > 0 ? acc[acc.length - 1].cum : 0) + (moyBase === 'net' ? j.net : j.brut)
    acc.push({
      label:     fmtJourShort(j.date),
      fullLabel: fmtJourDate(j.date),
      valeur:    parseFloat(((cum / (acc.length + 1)) * moyConf.mult).toFixed(2)),
      cum,
    })
    return acc
  }, [])

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
          label="Remises"
          value={kpis.remises_total > 0 ? `−${fmtEuroDisplay(kpis.remises_total)}` : '—'}
          sub={kpis.ventes_brutes > 0 && kpis.remises_total > 0 ? `${((kpis.remises_total / kpis.ventes_brutes) * 100).toFixed(1)}% du brut` : 'Aucune remise appliquée'}
          color="#f87171"
          active={kpiActif === 'remises'}
          onClick={() => setKpiActif('remises')}
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
        <div
          className={`col-span-2 bg-gray-900 border rounded-xl p-4 transition-colors ${
            kpiActif === 'moy' ? 'border-indigo-500' : 'border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setKpiActif('moy')} className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
              CA Moyen ({moyBase === 'net' ? 'net' : 'brut'})
            </button>
            <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg p-0.5">
              {(['net', 'brut'] as MoyBase[]).map(b => (
                <button
                  key={b}
                  onClick={() => { setMoyBase(b); setKpiActif('moy') }}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                    moyBase === b ? 'bg-rose-500/80 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {b === 'net' ? 'Net' : 'Brut'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setKpiActif('moy')} className="grid grid-cols-5 gap-2 text-center w-full">
            {[
              { label: 'Par jour',      val: moyValues.jour },
              { label: 'Par semaine',   val: moyValues.semaine },
              { label: 'Par mois',      val: moyValues.mois },
              { label: 'Par trimestre', val: moyValues.trimestre },
              { label: 'Par an',        val: moyValues.an },
            ].map(item => (
              <div key={item.label}>
                <p className="text-sm font-bold text-rose-400">{fmtEuroDisplay(item.val)}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{item.label}</p>
              </div>
            ))}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400 font-medium">
            {kpiActif === 'moy'
              ? `CA moyen (${moyBase === 'net' ? 'net' : 'brut'}) ${moyConf.label.toLowerCase()} — évolution`
              : `${kpiConf.label} — ${getGranulariteLabel(periode, debut, fin)}`}
          </p>
          {kpiActif === 'moy' && (
            <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg p-0.5">
              {MOY_GRAN.map(g => (
                <button
                  key={g.key}
                  onClick={() => setMoyGran(g.key)}
                  className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                    moyGran === g.key ? 'bg-rose-500/80 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {kpiActif === 'moy' ? (
          <AnalyticsLineChart
            data={moyChartData}
            xKey="label"
            series={[{ key: 'valeur', color: '#fb7185', label: `CA moyen (${moyBase === 'net' ? 'net' : 'brut'})` }]}
            formatValue={v => fmtEuroDisplay(v)}
          />
        ) : (
          <AnalyticsLineChart
            data={historique}
            xKey="label"
            series={[{ key: kpiConf.key, color: kpiConf.color, label: kpiConf.label }]}
            formatValue={v => fmtEuroDisplay(v)}
          />
        )}
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
            {jours.length > 0 && (
              <tfoot>
                <tr className="bg-gray-900/50 border-t border-gray-800">
                  <td className="px-4 py-2 text-gray-500 text-[10px]">Total</td>
                  <td className="px-4 py-2 text-center text-gray-500 text-[10px]">{totCmds}</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{fmtEuroDisplay(kpis.ventes_brutes)}</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{kpis.remises_total > 0 ? `−${fmtEuroDisplay(kpis.remises_total)}` : '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{fmtEuroDisplay(kpis.ventes_nettes)}</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-[10px]">{kpis.tva > 0 ? fmtEuroDisplay(kpis.tva) : '—'}</td>
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}<div className="col-span-2 h-20 bg-gray-800 rounded-xl"/></div>
      <div className="h-48 bg-gray-800 rounded-xl"/>
      <div className="h-72 bg-gray-800 rounded-xl"/>
    </div>
  )
}
