'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'

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
}

const CartContext = createContext<CartContextType | null>(null)

function slugFromPathname(pathname: string): string {
  return pathname.split('/').filter(Boolean)[0] ?? ''
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const slug = slugFromPathname(pathname)
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
  }), [items, isOpen, addItem, removeItem, clear, isInCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart doit être utilisé dans un CartProvider')
  return ctx
}
