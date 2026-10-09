'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { bornerPage, lirePageAdresse, type TaillePage } from '@/lib/pagination'
import { useTaillePage } from './TaillePage'
import type { BarrePagination } from './Pagination'

type Options = {
  // Paramètre d'adresse qui garde la page (« Retour » et F5 reviennent au même
  // endroit) ; un nom différent par tableau quand deux sont affichés ensemble ;
  // false quand le tableau change sans que l'adresse change (onglets en mémoire).
  adresse?: string | false
}

// Mode « dans la page » : toutes les lignes sont déjà chargées, on n'affiche
// que la page courante. `reinitialiser` = recherche, filtres, onglet, tri :
// dès qu'une de ces valeurs change, retour à la page 1. Le recalage se fait
// pendant le rendu (pas dans un effet, refusé par la règle lint du projet).
export function usePagination<T>(lignes: T[], reinitialiser: unknown[] = [], options: Options = {}): { lignes: T[]; barre: BarrePagination } {
  const parametre = options.adresse ?? 'page'
  const params = useSearchParams()
  const { taille, setTaille } = useTaillePage()
  const cle = JSON.stringify(reinitialiser)
  const [etat, setEtat] = useState(() => ({ page: parametre ? lirePageAdresse(params.get(parametre) ?? undefined) : 1, cle }))

  let page = etat.page
  if (etat.cle !== cle) {
    page = 1
    setEtat({ page: 1, cle })
  }
  // Tant que les lignes ne sont pas là, on garde la page demandée telle quelle
  const pageAffichee = lignes.length > 0 ? bornerPage(page, lignes.length, taille) : page
  const debut = (pageAffichee - 1) * taille

  // L'adresse suit la page sans rechargement (historique remplacé, pas ajouté :
  // « Retour » ramène à l'écran précédent, pas à la page précédente du tableau)
  useEffect(() => {
    if (!parametre || lignes.length === 0) return
    const url = new URL(window.location.href)
    if (pageAffichee > 1) url.searchParams.set(parametre, String(pageAffichee))
    else url.searchParams.delete(parametre)
    if (url.href !== window.location.href) window.history.replaceState(null, '', url.href)
  }, [parametre, pageAffichee, lignes.length])

  return {
    lignes: lignes.slice(debut, debut + taille),
    barre: {
      total: lignes.length,
      page: pageAffichee,
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
