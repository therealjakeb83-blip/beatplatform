'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ONGLETS = [
  {
    href: '',
    label: 'Accueil',
    match: (path: string, base: string) => path === base,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9z" />
      </svg>
    ),
  },
  {
    href: '/beats',
    label: 'Beats',
    match: (path: string, base: string) => path.startsWith(`${base}/beats`) || path.startsWith(`${base}/parcourir`),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" />
      </svg>
    ),
  },
  {
    href: '/abonnement',
    label: 'Abonnements',
    match: (path: string, base: string) => path.startsWith(`${base}/abonnement`) || path.startsWith(`${base}/membres`),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" />
      </svg>
    ),
  },
  {
    href: '/licences',
    label: 'Licences',
    match: (path: string, base: string) => path.startsWith(`${base}/licences`),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    href: '/beats',
    label: 'Recherche',
    // Pas de page de recherche dédiée dans l'app — raccourci vers le
    // catalogue (qui contient la recherche), jamais actif à part entière
    // pour ne pas entrer en conflit avec l'onglet "Beats".
    match: () => false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
    ),
  },
]

export default function MobileTabBar({ slug }: { slug: string }) {
  const pathname = usePathname()
  const base = `/${slug}`

  return (
    <nav className="shop-tabbar">
      {ONGLETS.map(onglet => {
        const active = onglet.match(pathname, base)
        return (
          <Link
            key={onglet.label}
            href={`${base}${onglet.href}`}
            className={`shop-tabbar-item${active ? ' is-active' : ''}`}
          >
            {onglet.icon}
            {onglet.label}
          </Link>
        )
      })}
    </nav>
  )
}
