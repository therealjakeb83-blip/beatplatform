'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RemboursementButton({
  commandeId,
  montant,
}: {
  commandeId: string
  montant: number
}) {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading' | 'done' | 'error'>('idle')
  const router = useRouter()

  async function handleConfirm() {
    setState('loading')
    try {
      const res = await fetch(`/api/business/commandes/${commandeId}/rembourser`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error()
      setState('done')
      setTimeout(() => router.refresh(), 800)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'done') {
    return <span className="text-xs text-green-400">Commande marquée comme remboursée.</span>
  }

  if (state === 'confirming') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Rembourser €{montant.toFixed(2)} ?</span>
        <button
          onClick={handleConfirm}
          className="px-3 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
        >
          Confirmer
        </button>
        <button
          onClick={() => setState('idle')}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          Annuler
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setState('confirming')}
      disabled={state === 'loading'}
      className="px-4 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors disabled:opacity-50"
    >
      {state === 'loading' ? 'En cours…' : 'Remboursement'}
    </button>
  )
}
