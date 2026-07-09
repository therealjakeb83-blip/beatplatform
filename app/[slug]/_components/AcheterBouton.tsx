'use client'

import { useCart } from './CartContext'

export default function AcheterBouton({
  beatId,
  licenceId,
  titre,
  imageUrl,
  licenceNom,
  prix,
}: {
  beatId: string
  licenceId: string
  titre: string
  imageUrl: string | null
  licenceNom: string
  prix: number
}) {
  const { addItem, isInCart, open } = useCart()
  const dejaAjoute = isInCart(beatId, licenceId)

  function ajouter() {
    if (dejaAjoute) {
      open()
      return
    }
    addItem({ beatId, licenceId, titre, imageUrl, licenceNom, prix })
  }

  return (
    <button
      onClick={ajouter}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
        dejaAjoute
          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          : 'bg-brand-600 hover:bg-brand-500 text-white shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]'
      }`}
    >
      {dejaAjoute ? 'Dans le panier ✓' : 'Ajouter au panier'}
    </button>
  )
}
