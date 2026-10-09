'use client'

import Pagination from './Pagination'
import { usePagination } from './usePagination'

// Pour un tableau rendu après des retours anticipés (chargement, erreur) où
// le hook ne peut pas être appelé : `children` reçoit les lignes de la page.
// Sans page dans l'adresse : utilisé par Analytics, dont la période et les
// onglets changent sans changer l'adresse (la page 1 doit revenir à chaque fois).
export default function Pagine<T>({ lignes, reinitialiser, children }: {
  lignes: T[]
  reinitialiser?: unknown[]
  children: (page: T[]) => React.ReactNode
}) {
  const pagination = usePagination(lignes, reinitialiser, { adresse: false })
  return (
    <>
      {children(pagination.lignes)}
      <Pagination {...pagination.barre} />
    </>
  )
}
