'use client'

import { createContext, useCallback, useContext } from 'react'
import { lienBoutique } from '@/lib/domaine-boutique'

const DomaineBoutiqueContext = createContext(false)

export function DomaineBoutiqueProvider({ surDomaine, children }: { surDomaine: boolean; children: React.ReactNode }) {
  return <DomaineBoutiqueContext.Provider value={surDomaine}>{children}</DomaineBoutiqueContext.Provider>
}

export function useSurDomaineBoutique(): boolean {
  return useContext(DomaineBoutiqueContext)
}

export function useLienBoutique(slug: string): (chemin?: string) => string {
  const surDomaine = useSurDomaineBoutique()
  return useCallback((chemin = '') => lienBoutique(slug, chemin, surDomaine), [slug, surDomaine])
}
