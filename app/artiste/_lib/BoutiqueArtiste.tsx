'use client'

import { createContext, useContext } from 'react'
import { slugBoutiqueDuChemin } from '@/lib/domaine-boutique'

// Sur un domaine de boutique, la boutique vient de l'adresse du site (les
// adresses de retour n'y contiennent pas le slug) ; sur sonoo.app, de
// l'adresse de retour (« /slug/... »).
const BoutiqueArtisteContext = createContext<string | null>(null)

export function BoutiqueArtisteProvider({ slugDomaine, children }: { slugDomaine: string | null; children: React.ReactNode }) {
  return <BoutiqueArtisteContext.Provider value={slugDomaine}>{children}</BoutiqueArtisteContext.Provider>
}

export function useSlugBoutiqueArtiste(redirect: string): string | null {
  const slugDomaine = useContext(BoutiqueArtisteContext)
  return slugDomaine ?? slugBoutiqueDuChemin(redirect)
}
