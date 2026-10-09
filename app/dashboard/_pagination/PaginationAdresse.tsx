'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { TaillePage } from '@/lib/pagination'
import { useTaillePage } from './TaillePage'
import Pagination from './Pagination'

// Mode « par l'adresse » : le serveur ne charge que la page demandée
// (`?page=N`, les autres paramètres — onglet, filtres — sont gardés) et lit
// la taille dans le cookie (`tailleTableaux()`).
export default function PaginationAdresse({ total, page, taille, parametre = 'page' }: {
  total: number
  page: number
  taille: TaillePage
  parametre?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { setTaille } = useTaillePage()

  function lienPage(p: number) {
    const sp = new URLSearchParams(params.toString())
    if (p <= 1) sp.delete(parametre)
    else sp.set(parametre, String(p))
    const qs = sp.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function onTaille(t: TaillePage) {
    setTaille(t)
    const premiereLigne = (page - 1) * taille
    const url = lienPage(Math.floor(premiereLigne / t) + 1)
    const actuelle = params.toString() ? `${pathname}?${params.toString()}` : pathname
    if (url === actuelle) router.refresh()
    else router.push(url)
  }

  return <Pagination total={total} page={page} taille={taille} lienPage={lienPage} onTaille={onTaille} />
}
