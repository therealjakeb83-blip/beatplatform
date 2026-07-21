'use client'

import { useCart } from './CartContext'

export default function CartBadge() {
  const { items, open } = useCart()

  return (
    <button onClick={open} className="shop-icon-btn" aria-label="Panier">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
        <path d="M6 8h12l-1 12H7L6 8Z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path>
      </svg>
      {items.length > 0 && (
        <span className="shop-cart-count">
          {items.length}
        </span>
      )}
    </button>
  )
}
