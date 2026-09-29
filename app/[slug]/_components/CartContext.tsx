'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { effacerPaiementEnCours, lirePaiementEnCours } from '../_lib/paiement-en-cours'

export type CartItem = {
  beatId: string
  licenceId: string
  titre: string
  imageUrl: string | null
  licenceNom: string
  prix: number
}

type CartContextType = {
  items: CartItem[]
  isOpen: boolean
  open: () => void
  close: () => void
  addItem: (item: CartItem) => void
  removeItem: (beatId: string, licenceId: string) => void
  clear: () => void
  isInCart: (beatId: string, licenceId: string) => boolean
  // 'en_cours' : un paiement lancé avant un rechargement n'est pas terminé —
  // ne jamais proposer de repayer. 'recu' : débité, commande en préparation.
  paiementEnCours: 'non' | 'en_cours' | 'recu'
}

type EtatPaiement =
  | { etat: 'termine'; commande_id: string }
  | { etat: 'en_cours'; paye: boolean }
  | { etat: 'abandonne' }
  | { etat: 'interrompu' }

// Au-delà, un paiement déjà débité dont la commande tarde est présenté comme
// reçu (panier vidé) ; un paiement jamais débité rend la main au panier.
// Plus long que la durée max de /api/stripe/paiement-multi/payer (60 s) :
// passé ce délai, aucun encaissement ne peut plus démarrer côté serveur.
const ATTENTE_MAX_MS = 90 * 1000

const CartContext = createContext<CartContextType | null>(null)

function slugFromPathname(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? ''
}

// `slug` : à passer explicitement depuis une page hors de l'arborescence
// `app/[slug]/**` (ex. app/paiement/[slug]) — sinon `slugFromPathname` lirait
// le mauvais premier segment d'URL et pointerait vers une autre clé
// localStorage que celle où le panier de cette boutique a été rempli.
export function CartProvider({ children, slug: slugProp }: { children: React.ReactNode; slug?: string }) {
  const pathname = usePathname()
  const slug = slugProp ?? slugFromPathname(pathname)
  const storageKey = `panier_${slug}`

  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Charge le panier de cette boutique depuis localStorage au montage / changement de boutique
  useEffect(() => {
    setHydrated(false)
    try {
      const raw = localStorage.getItem(storageKey)
      setItems(raw ? JSON.parse(raw) : [])
    } catch {
      setItems([])
    }
    setHydrated(true)
  }, [storageKey])

  // Persiste à chaque changement (jamais avant l'hydratation, pour ne pas écraser
  // le panier stocké par un tableau vide le temps du premier rendu)
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch {}
  }, [items, storageKey, hydrated])

  // Paiement lancé puis page rechargée (Phase 13, lot 2) : on demande au
  // serveur où il en est avant de laisser repayer le même panier.
  const [paiementEnCours, setPaiementEnCours] = useState<'non' | 'en_cours' | 'recu'>('non')
  useEffect(() => {
    if (!hydrated || !slug) return
    const marqueur = lirePaiementEnCours(slug)
    if (!marqueur) return
    let arret = false
    const debut = Date.now()
    ;(async () => {
      while (!arret) {
        let data: EtatPaiement | null = null
        try {
          const res = await fetch('/api/stripe/etat-paiement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: marqueur.type, id: marqueur.id, annuler: marqueur.memeOnglet }),
          })
          if (res.ok) data = await res.json()
        } catch {}
        if (arret) return

        if (data?.etat === 'termine') {
          effacerPaiementEnCours(slug)
          setItems([])
          window.location.href = `/telechargement/${data.commande_id}`
          return
        }
        if (data?.etat === 'abandonne') {
          effacerPaiementEnCours(slug)
          setPaiementEnCours('non')
          return
        }
        if (data?.etat === 'interrompu') {
          setPaiementEnCours('non')
          return
        }
        if (Date.now() - debut > ATTENTE_MAX_MS) {
          if (data?.etat === 'en_cours' && data.paye) {
            setItems([])
            setPaiementEnCours('recu')
          } else {
            setPaiementEnCours('non')
          }
          return
        }
        setPaiementEnCours('en_cours')
        await new Promise(r => setTimeout(r, 2000))
      }
    })()
    return () => { arret = true }
  }, [hydrated, slug])

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      if (prev.some(i => i.beatId === item.beatId && i.licenceId === item.licenceId)) return prev
      return [...prev, item]
    })
    setIsOpen(true)
  }, [])

  const removeItem = useCallback((beatId: string, licenceId: string) => {
    setItems(prev => prev.filter(i => !(i.beatId === beatId && i.licenceId === licenceId)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const isInCart = useCallback(
    (beatId: string, licenceId: string) => items.some(i => i.beatId === beatId && i.licenceId === licenceId),
    [items]
  )

  const value = useMemo<CartContextType>(() => ({
    items,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    addItem,
    removeItem,
    clear,
    isInCart,
    paiementEnCours,
  }), [items, isOpen, addItem, removeItem, clear, isInCart, paiementEnCours])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart doit être utilisé dans un CartProvider')
  return ctx
}
