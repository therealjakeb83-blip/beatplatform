'use client'

import { useEffect, useState } from 'react'
import { useParams }           from 'next/navigation'
import Link                    from 'next/link'
import KpiCard                 from '../../_components/KpiCard'
import AnalyticsLineChart      from '../../_components/AnalyticsLineChart'
import PeriodSelector          from '../../_components/PeriodSelector'
import { fmtEuroDisplay, fmtDate, type Periode } from '../../_lib/periode'

type Beat = { id: string; titre: string; couleur: string | null; styles: string[]; bpm: number; cle: string | null; statut: string }
type Vente = { id: string; created_at: string; licence_nom: string; source_marketing: string; prix_paye: number; reduction_montant: number | null }
type Data = {
  beat: Beat
  kpis: { ca_brut: number; ca_net: number; ventes: number; ecoutes: number; free_dl: number }
  ventes_detail: Vente[]
  ca_par_licence: Array<{ nom: string; ca: number; ventes: number }>
  ca_par_source:  Array<{ source: string; ca: number }>
  collabs: Array<{ id: string; nom: string; pourcentage: number; statut: string }>
  historique: Array<Record<string, unknown>>
}

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', youtube: 'YouTube', google: 'Google', direct: 'Direct', autre: 'Autre',
}
const STATUT_BEAT: Record<string, string> = {
  public: 'Public', prive: 'Privé', masque: 'Masqué', programme: 'Programmé', vendu: 'Exclusif vendu',
}

type KpiKey = 'ventes' | 'ecoutes' | 'free_dl'

export default function BeatDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data,     setData]    = useState<Data | null>(null)
  const [loading,  setLoading] = useState(true)
  const [kpiActif, setKpiActif] = useState<KpiKey>('ventes')
  const [periode,  setPeriode] = useState<Periode>('tout')
  const [debut,    setDebut]   = useState('')
  const [fin,      setFin]     = useState('')

  function load(p: Periode, d: string, f: string) {
    setLoading(true)
    const params = new URLSearchParams({ periode: p })
    if (p === 'custom') { if (d) params.set('debut', d); if (f) params.set('fin', f) }
    fetch(`/api/business/analytics/beats/${id}?${params}`)
      .then(r => r.json())
      .then(v => { setData(v); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load(periode, debut, fin) }, [])

  function handlePeriode(p: Periode, d: string, f: string) {
    setPeriode(p); setDebut(d); setFin(f)
    load(p, d, f)
  }

  const beat   = data?.beat
  const kpis   = data?.kpis
  const hist   = data?.historique ?? []
  const maxLic = Math.max(...(data?.ca_par_licence ?? []).map(l => l.ca), 1)
  const maxSrc = Math.max(...(data?.ca_par_source  ?? []).map(s => s.ca), 1)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard/business/analytics?tab=beats" className="text-gray-500 hover:text-white text-xs transition-colors">
            ← Retour aux beats
          </Link>
        </div>

        {beat && (
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
              style={{ background: beat.couleur ?? '#6366f1' }}>
              {beat.titre.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">{beat.titre}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-700 text-gray-300 border border-gray-600">
                  {STATUT_BEAT[beat.statut] ?? beat.statut}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {beat.styles?.join(', ')} {beat.bpm ? `· ${beat.bpm} BPM` : ''} {beat.cle ? `· ${beat.cle}` : ''}
              </p>
            </div>
          </div>
        )}

        <PeriodSelector value={periode} debut={debut} fin={fin} onChange={handlePeriode} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            {Array.from({length:4}).map((_,i)=><div key={i} className="h-20 bg-gray-800 rounded-xl"/>)}
            <div className="h-52 bg-gray-800 rounded-xl"/>
          </div>
        ) : !data ? (
          <p className="text-gray-500 text-sm">Erreur de chargement.</p>
        ) : (
          <div className="space-y-6">
            {/* KPIs financiers */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="CA Brut" value={fmtEuroDisplay(kpis!.ca_brut)} sub={`Net : ${fmtEuroDisplay(kpis!.ca_net)}`} color="#4ade80" />
              <KpiCard label="CA Net"  value={fmtEuroDisplay(kpis!.ca_net)}  color="#22d3ee" />
            </div>

            {/* KPIs engagement */}
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Ventes"  value={String(kpis!.ventes)}  color="#8b5cf6" active={kpiActif === 'ventes'}  onClick={() => setKpiActif('ventes')} />
              <KpiCard label="Écoutes" value={String(kpis!.ecoutes)} color="#818cf8" active={kpiActif === 'ecoutes'} onClick={() => setKpiActif('ecoutes')} />
              <KpiCard label="Free DL" value={String(kpis!.free_dl)} color="#38bdf8" active={kpiActif === 'free_dl'} onClick={() => setKpiActif('free_dl')} />
            </div>

            {/* Chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 font-medium mb-3">
                {kpiActif === 'ventes' ? 'Ventes' : kpiActif === 'ecoutes' ? 'Écoutes' : 'Free DL'} — 12 mois
              </p>
              <AnalyticsLineChart
                data={hist}
                xKey="label"
                series={[{ key: kpiActif, color: kpiActif === 'ventes' ? '#8b5cf6' : kpiActif === 'ecoutes' ? '#818cf8' : '#38bdf8', label: kpiActif }]}
                formatValue={v => String(Math.round(v))}
              />
            </div>

            {/* 2 colonnes : CA par licence + CA par source */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-white mb-3">CA par licence</p>
                <div className="space-y-2">
                  {data.ca_par_licence.map(l => (
                    <div key={l.nom}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-300">{l.nom}</span>
                        <span className="text-xs text-green-400 font-medium">{fmtEuroDisplay(l.ca)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${(l.ca / maxLic) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  {data.ca_par_licence.length === 0 && <p className="text-xs text-gray-600">Aucune vente</p>}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-white mb-3">CA par source</p>
                <div className="space-y-2">
                  {data.ca_par_source.map(s => (
                    <div key={s.source}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-300">{SOURCE_LABELS[s.source] ?? s.source}</span>
                        <span className="text-xs text-green-400 font-medium">{fmtEuroDisplay(s.ca)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(s.ca / maxSrc) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  {data.ca_par_source.length === 0 && <p className="text-xs text-gray-600">Aucune vente</p>}
                </div>
              </div>
            </div>

            {/* Collabs */}
            {data.collabs.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-white mb-3">Collaborateurs</p>
                <div className="space-y-2">
                  {data.collabs.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-1">
                      <span className="text-xs text-gray-300">{c.nom}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-indigo-400 font-medium">{c.pourcentage}%</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          c.statut === 'actif' ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
                          c.statut === 'en_attente' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                          'bg-gray-700 text-gray-400 border border-gray-600'
                        }`}>{c.statut}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table ventes */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <p className="px-4 py-3 text-xs font-semibold text-white border-b border-gray-800">
                Ventes ({data.ventes_detail.length})
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                    <th className="text-left px-4 py-2">Licence</th>
                    <th className="text-left px-4 py-2">Source</th>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-right px-4 py-2">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ventes_detail.map(v => (
                    <tr key={v.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                          {v.licence_nom}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{SOURCE_LABELS[v.source_marketing] ?? v.source_marketing}</td>
                      <td className="px-4 py-2.5 text-gray-400">{fmtDate(v.created_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-green-400 font-medium">{fmtEuroDisplay(v.prix_paye)}</span>
                        {v.reduction_montant ? <span className="text-gray-600 ml-1 text-[10px]">−{fmtEuroDisplay(v.reduction_montant)}</span> : null}
                      </td>
                    </tr>
                  ))}
                  {data.ventes_detail.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">Aucune vente</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
