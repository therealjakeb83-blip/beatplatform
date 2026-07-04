'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { initiales } from '../_lib/utils'

const BASE = '/dashboard/business'

const CRM_ROUTES       = [`${BASE}/contacts`, `${BASE}/doublons`, `${BASE}/listes`, `${BASE}/segments`]
const MARKETING_ROUTES = [`${BASE}/marketing`]
const COMMERCE_ROUTES  = [`${BASE}/commandes`, `${BASE}/abonnements`, `${BASE}/plans`, `${BASE}/beats`, `${BASE}/codes-promo`, `${BASE}/licences`, `${BASE}/collabs`]
const ANALYTICS_ROUTE  = `${BASE}/analytics`

export default function Sidebar({ nomArtiste }: { nomArtiste: string }) {
  const pathname = usePathname()

  const isCrm       = CRM_ROUTES.some(r => pathname.startsWith(r))
  const isMarketing = MARKETING_ROUTES.some(r => pathname.startsWith(r))
  const isCommerce  = COMMERCE_ROUTES.some(r => pathname.startsWith(r))
  const isAnalytics = pathname.startsWith(ANALYTICS_ROUTE)

  const [crmOpen,       setCrmOpen]       = useState(isCrm)
  const [marketingOpen, setMarketingOpen] = useState(isMarketing)
  const [commerceOpen,  setCommerceOpen]  = useState(isCommerce)
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalytics)

  function navItem(href: string, label: string, active: boolean) {
    return (
      <Link
        href={href}
        className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-indigo-600 text-white font-semibold'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
        }`}
      >
        {label}
      </Link>
    )
  }

  function subItem(href: string, label: string, active: boolean, badge?: number) {
    return (
      <Link
        href={href}
        className={`flex items-center justify-between pl-8 pr-3 py-1.5 rounded-lg text-xs transition-colors ${
          active
            ? 'text-white bg-gray-800'
            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
        }`}
      >
        <span>{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  function sectionHeader(
    href: string,
    label: string,
    active: boolean,
    open: boolean,
    onToggle: () => void,
    onNavigate: () => void,
  ) {
    const base = `flex items-center rounded-lg text-sm transition-colors ${
      active
        ? 'bg-indigo-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
    }`

    return (
      <div className={base}>
        <Link
          href={href}
          onClick={onNavigate}
          className={`flex-1 px-3 py-2 ${active ? 'font-semibold' : ''}`}
        >
          {label}
        </Link>
        <button
          onClick={onToggle}
          className="px-2.5 py-2 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Déplier / replier"
        >
          <span
            className="inline-block text-[10px] transition-transform duration-150"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            ▾
          </span>
        </button>
      </div>
    )
  }

  const searchParams = useSearchParams()
  const tabActif     = searchParams.get('tab') ?? 'overview'
  const initiale     = initiales(nomArtiste)

  return (
    <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
      {/* Header beatmaker */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-xs">{initiale}</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none truncate max-w-[120px]">
              {nomArtiste}
            </p>
            <p className="text-gray-600 text-[10px] mt-0.5">My Producer</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-4 flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {navItem(`${BASE}`, "Vue d'ensemble", pathname === BASE || pathname === `${BASE}/`)}

        <div className="my-3 border-t border-gray-800" />

        {/* CRM */}
        {sectionHeader(
          `${BASE}/contacts`,
          'CRM',
          isCrm,
          crmOpen,
          () => setCrmOpen(o => !o),
          () => setCrmOpen(true),
        )}
        {crmOpen && (
          <>
            {subItem(`${BASE}/contacts`,  'Contacts', pathname.startsWith(`${BASE}/contacts`))}
            {subItem(`${BASE}/doublons`,  'Doublons', pathname.startsWith(`${BASE}/doublons`))}
            {subItem(`${BASE}/listes`,    'Listes',   pathname.startsWith(`${BASE}/listes`))}
            {subItem(`${BASE}/segments`,  'Segments', pathname.startsWith(`${BASE}/segments`))}
          </>
        )}

        <div className="my-3 border-t border-gray-800" />

        {/* Marketing */}
        {sectionHeader(
          `${BASE}/marketing/campagnes`,
          'Marketing',
          isMarketing,
          marketingOpen,
          () => setMarketingOpen(o => !o),
          () => setMarketingOpen(true),
        )}
        {marketingOpen && (
          <>
            {subItem(`${BASE}/marketing/campagnes`, 'Campagnes', pathname.startsWith(`${BASE}/marketing/campagnes`))}
            {subItem(`${BASE}/marketing/templates`, 'Templates', pathname.startsWith(`${BASE}/marketing/templates`))}
            {subItem(`${BASE}/marketing/automatisations`, 'Automatisations', pathname.startsWith(`${BASE}/marketing/automatisations`))}
          </>
        )}

        <div className="my-3 border-t border-gray-800" />

        {/* Commerce */}
        {sectionHeader(
          `${BASE}/commandes`,
          'Commerce',
          isCommerce,
          commerceOpen,
          () => setCommerceOpen(o => !o),
          () => setCommerceOpen(true),
        )}
        {commerceOpen && (
          <>
            {subItem(`${BASE}/commandes`,   'Commandes',   pathname.startsWith(`${BASE}/commandes`))}
            {subItem(`${BASE}/abonnements`, 'Abonnements', pathname.startsWith(`${BASE}/abonnements`))}
            {subItem(`${BASE}/plans`,       'Plans',       pathname.startsWith(`${BASE}/plans`))}
            {subItem(`${BASE}/beats`,       'Beats',       pathname.startsWith(`${BASE}/beats`))}
            {subItem(`${BASE}/codes-promo`, 'Codes promo', pathname.startsWith(`${BASE}/codes-promo`))}
            {subItem(`${BASE}/licences`,    'Licences',    pathname.startsWith(`${BASE}/licences`))}
            {subItem(`${BASE}/collabs`,     'Collabs',     pathname.startsWith(`${BASE}/collabs`))}
          </>
        )}

        <div className="my-3 border-t border-gray-800" />

        {/* Analytics */}
        {sectionHeader(
          `${BASE}/analytics`,
          'Analytics',
          isAnalytics,
          analyticsOpen,
          () => setAnalyticsOpen(o => !o),
          () => setAnalyticsOpen(true),
        )}
        {analyticsOpen && (
          <>
            {subItem(`${BASE}/analytics?tab=overview`,    "Vue d'ensemble", isAnalytics && tabActif === 'overview')}
            {subItem(`${BASE}/analytics?tab=beats`,       'Beats',          isAnalytics && tabActif === 'beats')}
            {subItem(`${BASE}/analytics?tab=commandes`,   'Ventes',         isAnalytics && tabActif === 'commandes')}
            {subItem(`${BASE}/analytics?tab=abonnements`, 'MRR / ARR',      isAnalytics && tabActif === 'abonnements')}
            {subItem(`${BASE}/analytics?tab=revenus`,     'Revenus',        isAnalytics && tabActif === 'revenus')}
            {subItem(`${BASE}/analytics?tab=preferences`, 'Préférences',    isAnalytics && tabActif === 'preferences')}
            {subItem(`${BASE}/analytics?tab=codes-promo`, 'Codes promo',    isAnalytics && tabActif === 'codes-promo')}
          </>
        )}
      </nav>
    </aside>
  )
}
