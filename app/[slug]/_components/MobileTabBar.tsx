'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ONGLETS = [
  {
    href: '',
    label: 'Accueil',
    match: (path: string, base: string) => path === base,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: '/beats',
    label: 'Beats',
    match: (path: string, base: string) => path.startsWith(`${base}/beats`) || path.startsWith(`${base}/parcourir`),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    href: '/abonnement',
    label: 'Abonnements',
    match: (path: string, base: string) => path.startsWith(`${base}/abonnement`) || path.startsWith(`${base}/membres`),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 6 6 1-4.5 4.5 1 6L12 16l-5.5 3.5 1-6L3 9l6-1z" />
      </svg>
    ),
  },
  {
    href: '/licences',
    label: 'Licences',
    match: (path: string, base: string) => path.startsWith(`${base}/licences`),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
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
