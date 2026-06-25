'use client'

import { useSearchParams } from 'next/navigation'
import { useState }        from 'react'
import PeriodSelector      from './PeriodSelector'
import type { Periode }    from '../_lib/periode'

import TabOverview    from './TabOverview'
import TabVentes      from './TabVentes'
import TabRevenus     from './TabRevenus'
import TabAbonnements from './TabAbonnements'
import TabCodesPromo  from './TabCodesPromo'
import TabPreferences from './TabPreferences'
import TabBeats       from './TabBeats'

const TABS = [
  { key: 'overview',     label: "Vue d'ensemble", Component: TabOverview },
  { key: 'commandes',    label: 'Ventes',          Component: TabVentes },
  { key: 'revenus',      label: 'Revenus',         Component: TabRevenus },
  { key: 'abonnements',  label: 'Abonnements',     Component: TabAbonnements },
  { key: 'codes-promo',  label: 'Codes promo',     Component: TabCodesPromo },
  { key: 'preferences',  label: 'Préférences',     Component: TabPreferences },
  { key: 'beats',        label: 'Beats',           Component: TabBeats },
]

export default function AnalyticsClient() {
  const params = useSearchParams()
  const tab    = params.get('tab') ?? 'overview'

  const [periode, setPeriode] = useState<Periode>('tout')
  const [debut,   setDebut]   = useState('')
  const [fin,     setFin]     = useState('')

  function handlePeriode(p: Periode, d: string, f: string) {
    setPeriode(p)
    setDebut(d)
    setFin(f)
  }

  const active = TABS.find(t => t.key === tab) ?? TABS[0]
  const { Component } = active

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800 space-y-3">
        <h1 className="text-lg font-bold text-white">Analytics</h1>
        <PeriodSelector value={periode} debut={debut} fin={fin} onChange={handlePeriode} />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Component periode={periode} debut={debut} fin={fin} />
      </div>
    </div>
  )
}
