'use client'

import Pagination from './Pagination'
import { usePagination } from './usePagination'

// Pour un tableau rendu après des retours anticipés (chargement, erreur) où
// le hook ne peut pas être appelé : `children` reçoit les lignes de la page.
export default function Pagine<T>({ lignes, reinitialiser, children }: {
  lignes: T[]
  reinitialiser?: unknown[]
  children: (page: T[]) => React.ReactNode
}) {
  const pagination = usePagination(lignes, reinitialiser)
  return (
    <>
      {children(pagination.lignes)}
      <Pagination {...pagination.barre} />
    </>
  )
}
