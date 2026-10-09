'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { TAILLES_PAGE, nbPages, type TaillePage } from '@/lib/pagination'

export type BarrePagination = {
  total: number
  page: number
  taille: TaillePage
  onTaille: (t: TaillePage) => void
  // Mode « dans la page » : changement de page par état ; mode « par l'adresse » : liens
  onPage?: (p: number) => void
  lienPage?: (p: number) => string
}

// 1 … 4 5 6 … 31
function numeros(page: number, dernier: number): (number | '…')[] {
  const garder = new Set([1, dernier, page - 1, page, page + 1].filter(n => n >= 1 && n <= dernier))
  const tries = [...garder].sort((a, b) => a - b)
  const res: (number | '…')[] = []
  tries.forEach((n, i) => {
    if (i > 0 && n - tries[i - 1] === 2) res.push(n - 1)
    else if (i > 0 && n - tries[i - 1] > 2) res.push('…')
    res.push(n)
  })
  return res
}

const fr = (n: number) => n.toLocaleString('fr-FR')

export default function Pagination({ total, page, taille, onTaille, onPage, lienPage }: BarrePagination) {
  const ref = useRef<HTMLDivElement>(null)

  // Un tableau qui tient sur la plus petite taille n'a pas besoin de barre
  if (total <= TAILLES_PAGE[0]) return null

  const dernier = nbPages(total, taille)
  const debut = (page - 1) * taille + 1
  const fin = Math.min(page * taille, total)

  // Après un changement de page en bas du tableau, on remonte au début du tableau
  function remonter() {
    const tableau = ref.current?.previousElementSibling ?? ref.current?.parentElement?.previousElementSibling

    if (tableau && tableau.getBoundingClientRect().top < 0) tableau.scrollIntoView({ block: 'start' })
  }

  function bouton(p: number, contenu: React.ReactNode, cle: string, actif = false, desactive = false) {
    const classes = `min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-lg text-sm transition-colors ${
      actif ? 'bg-indigo-600 text-white' : desactive ? 'text-gray-700 pointer-events-none' : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`
    if (lienPage && !desactive && !actif) return <Link key={cle} href={lienPage(p)} className={classes}>{contenu}</Link>
    return (
      <button key={cle} type="button" disabled={desactive || actif} className={classes}
        onClick={() => { onPage?.(p); remonter() }}>
        {contenu}
      </button>
    )
  }

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm border-t border-gray-800">
      <span className="text-gray-400 tabular-nums">{fr(debut)}–{fr(fin)} sur {fr(total)}</span>

      <div className="flex items-center gap-1">
        {dernier > 1 && (
          <>
            {bouton(page - 1, '‹', 'prec', false, page <= 1)}
            {numeros(page, dernier).map((n, i) =>
              n === '…'
                ? <span key={`e${i}`} className="px-1 text-gray-600">…</span>
                : bouton(n, fr(n), `p${n}`, n === page))}
            {bouton(page + 1, '›', 'suiv', false, page >= dernier)}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-gray-500">Lignes par page</span>
        <div className="flex rounded-lg border border-gray-800 overflow-hidden">
          {TAILLES_PAGE.map(t => (
            <button key={t} type="button" onClick={() => onTaille(t)}
              className={`px-2.5 h-8 text-sm transition-colors ${t === taille ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-900'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
