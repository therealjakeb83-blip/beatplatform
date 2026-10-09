'use client'

import { useState } from 'react'
import { bornerPage, type TaillePage } from '@/lib/pagination'
import { useTaillePage } from './TaillePage'
import type { BarrePagination } from './Pagination'

// Mode « dans la page » : toutes les lignes sont déjà chargées, on n'affiche
// que la page courante. `reinitialiser` = recherche, filtres, onglet, tri :
// dès qu'une de ces valeurs change, retour à la page 1. Le recalage se fait
// pendant le rendu (pas dans un effet, refusé par la règle lint du projet).
export function usePagination<T>(lignes: T[], reinitialiser: unknown[] = []): { lignes: T[]; barre: BarrePagination } {
  const { taille, setTaille } = useTaillePage()
  const cle = JSON.stringify(reinitialiser)
  const [etat, setEtat] = useState({ page: 1, cle })

  let page = etat.page
  if (etat.cle !== cle) {
    page = 1
    setEtat({ page: 1, cle })
  }
  page = bornerPage(page, lignes.length, taille)
  const debut = (page - 1) * taille

  return {
    lignes: lignes.slice(debut, debut + taille),
    barre: {
      total: lignes.length,
      page,
      taille,
      onPage: p => setEtat({ page: p, cle }),
      // La première ligne affichée reste visible après le changement de taille
      onTaille: (t: TaillePage) => {
        setTaille(t)
        setEtat({ page: Math.floor(debut / t) + 1, cle })
      },
    },
  }
}
