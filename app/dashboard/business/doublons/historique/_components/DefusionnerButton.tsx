'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DefusionnerButton({ fusionId }: { fusionId: string }) {
  const [confirme, setConfirme] = useState(false)
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  async function defusionner() {
    setLoading(true)
    await fetch('/api/business/doublons/defusionner', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fusionId }),
    })
    router.refresh()
    setLoading(false)
    setConfirme(false)
  }

  if (confirme) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={defusionner}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold transition-colors"
        >
          {loading ? '…' : 'Confirmer'}
        </button>
        <button
          onClick={() => setConfirme(false)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Annuler
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirme(true)}
      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
    >
      Défusionner
    </button>
  )
}
