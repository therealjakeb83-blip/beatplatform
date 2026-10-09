'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { COOKIE_TAILLE_PAGE, TAILLE_PAGE_DEFAUT, type TaillePage } from '@/lib/pagination'

type Valeur = { taille: TaillePage; setTaille: (t: TaillePage) => void }

const Contexte = createContext<Valeur | null>(null)

function ecrireCookie(t: TaillePage) {
  document.cookie = `${COOKIE_TAILLE_PAGE}=${t}; path=/; max-age=31536000; samesite=lax`
}

// Posé dans les layouts Business et Admin avec la taille lue dans le cookie
// par le serveur : un changement dans un tableau s'applique tout de suite
// aux autres tableaux affichés, et aux pages ouvertes ensuite.
export function TaillePageProvider({ initiale, children }: { initiale: TaillePage; children: React.ReactNode }) {
  const [taille, setT] = useState<TaillePage>(initiale)
  const setTaille = useCallback((t: TaillePage) => {
    setT(t)
    ecrireCookie(t)
  }, [])
  const valeur = useMemo(() => ({ taille, setTaille }), [taille, setTaille])
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useTaillePage(): Valeur {
  const ctx = useContext(Contexte)
  const [locale, setLocale] = useState<TaillePage>(TAILLE_PAGE_DEFAUT)
  const setLocaleEtCookie = useCallback((t: TaillePage) => {
    setLocale(t)
    ecrireCookie(t)
  }, [])
  return ctx ?? { taille: locale, setTaille: setLocaleEtCookie }
}
