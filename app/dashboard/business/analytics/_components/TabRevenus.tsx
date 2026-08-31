'use client'

import { useEffect, useState } from 'react'
import Link                from 'next/link'
import KpiCard            from './KpiCard'
import AnalyticsLineChart from './AnalyticsLineChart'
import { periodeToSearch, fmtEuroDisplay, getGranulariteLabel, type Periode } from '../_lib/periode'

type Props = { periode: Periode; debut: string; fin: string }

type MoyValues = { jour: number; semaine: number; mois: number; trimestre: number; an: number }

type LitigeStatut = 'en_cours' | 'gagne' | 'perdu'
type LitigeRow = { id: string; commande_id: string; montant: number; statut: LitigeStatut; ouvert_le: string; ferme_le: string | null }

type Data = {
  kpis: {
    ventes_brutes: number; remises_total: number; ventes_nettes: number; tva: number; tva_taux: number
    moy_brut: MoyValues; moy_net: MoyValues
    litiges_en_cours: number; remboursements_total: number
  }
  jours: Array<{ date: string; nb: number; brut: number; remises: number; net: number; tva: number }>
  historique: Array<Record<string, unknown>>
  litiges: LitigeRow[]
}

const LITIGE_STATUT_LABEL: Record<LitigeStatut, string> = { en_cours: 'En cours', gagne: 'Gagné', perdu: 'Perdu' }
const LITIGE_STATUT_CLS: Record<LitigeStatut, string> = {
  en_cours: 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  gagne:    'bg-green-500/15  text-green-400  border border-green-500/20',
  perdu:    'bg-red-500/15    text-red-400    border border-red-500/20',
}

type MoyBase = 'net' | 'brut'

type KpiKey = 'brut' | 'remises' | 'net' | 'tva' | 'moy'
const KPI_CONFIG: Array<{ key: 'brut' | 'remises' | 'net' | 'tva'; label: string; color: string }> = [
  { key: 'brut',    label: 'Ventes brutes (TTC)', color: '#4ade80' },
  { key: 'remises', label: 'Remises',              color: '#f87171' },
  { key: 'net',     label: 'CA net (HT)',          color: '#22d3ee' },
  { key: 'tva',     label: 'TVA',                  color: '#f59e0b' },
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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
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

  const { kpis, jours, historique, litiges } = data
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
          label="Ventes brutes (TTC)"
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
          label="CA net (HT)"
          value={fmtEuroDisplay(kpis.ventes_nettes)}
          sub={kpis.ventes_brutes > 0 ? `${((kpis.ventes_nettes / kpis.ventes_brutes) * 100).toFixed(0)}% du brut TTC` : undefined}
          color="#22d3ee"
          active={kpiActif === 'net'}
          onClick={() => setKpiActif('net')}
        />
        <KpiCard
          label="TVA collectée"
          value={fmtEuroDisplay(kpis.tva)}
          sub={kpis.tva_taux > 0 ? `Taux : ${kpis.tva_taux}% — à reverser, hors CA net` : 'Non assujetti'}
          color="#f59e0b"
          active={kpiActif === 'tva'}
          onClick={() => setKpiActif('tva')}
        />
        <KpiCard
          label="Litiges en cours"
          value={kpis.litiges_en_cours > 0 ? fmtEuroDisplay(kpis.litiges_en_cours) : '—'}
          sub="Argent séquestré par Stripe en ce moment"
          color="#fb923c"
          badge="actuel"
        />
        <KpiCard
          label="Remboursements"
          value={kpis.remboursements_total > 0 ? `−${fmtEuroDisplay(kpis.remboursements_total)}` : '—'}
          sub="Manuels + litiges perdus"
          color="#f87171"
          badge="periode"
        />
        {/* Carte CA moyen */}
        <div
          className={`col-span-2 bg-gray-900 border rounded-xl p-4 transition-colors ${
            kpiActif === 'moy' ? 'border-indigo-500' : 'border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setKpiActif('moy')} className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
              CA Moyen ({moyBase === 'net' ? 'net, HT' : 'brut, TTC'})
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
                  {b === 'net' ? 'HT' : 'TTC'}
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
              ? `CA moyen (${moyBase === 'net' ? 'net, HT' : 'brut, TTC'}) ${moyConf.label.toLowerCase()} — évolution`
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
            series={[{ key: 'valeur', color: '#fb7185', label: `CA moyen (${moyBase === 'net' ? 'net, HT' : 'brut, TTC'})` }]}
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
                <th className="text-right px-4 py-2">Ventes brutes (TTC)</th>
                <th className="text-right px-4 py-2">Remises</th>
                <th className="text-right px-4 py-2">CA net (HT)</th>
                <th className="text-right px-4 py-2">TVA{kpis.tva_taux > 0 ? ` (${kpis.tva_taux}%)` : ''}</th>
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

      {/* Historique des litiges — pratique pour les déclarations fiscales */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs font-semibold text-white">Historique des litiges</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Filtré par date d&apos;ouverture du litige — utile pour tes déclarations.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                <th className="text-left px-4 py-2">Ouvert le</th>
                <th className="text-left px-4 py-2">Fermé le</th>
                <th className="text-right px-4 py-2">Montant</th>
                <th className="text-left px-4 py-2">Statut</th>
                <th className="text-right px-4 py-2">Commande</th>
              </tr>
            </thead>
            <tbody>
              {litiges.map(l => (
                <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-gray-300">{fmtDateTime(l.ouvert_le)}</td>
                  <td className="px-4 py-2.5 text-gray-400">{l.ferme_le ? fmtDateTime(l.ferme_le) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-300 font-medium">{fmtEuroDisplay(l.montant)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${LITIGE_STATUT_CLS[l.statut]}`}>
                      {LITIGE_STATUT_LABEL[l.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard/business/commandes/${l.commande_id}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
              {litiges.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Aucun litige sur cette période</td></tr>
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
