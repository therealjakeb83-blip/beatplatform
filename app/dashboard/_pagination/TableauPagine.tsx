'use client'

import Pagination from './Pagination'
import { usePagination } from './usePagination'

// Pour une page serveur : le serveur prépare toutes les lignes UNE fois
// (`lignes` = les <tr> déjà rendus), le navigateur n'affiche que la page
// courante — changer de page ne refait pas le calcul côté serveur.
export default function TableauPagine({ entete, lignes, classeTable, classeCorps, parametre = 'page' }: {
  entete: React.ReactNode
  lignes: React.ReactNode[]
  classeTable?: string
  classeCorps?: string
  parametre?: string
}) {
  const pagination = usePagination(lignes, [], { adresse: parametre })
  return (
    <>
      <table className={classeTable}>
        {entete}
        <tbody className={classeCorps}>{pagination.lignes}</tbody>
      </table>
      <Pagination {...pagination.barre} />
    </>
  )
}
