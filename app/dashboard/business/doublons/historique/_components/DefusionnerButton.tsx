'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DefusionnerButton({ fusionId }: { fusionId: string }) {
  const [confirme, setConfirme] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [erreur, setErreur]     = useState<string | null>(null)
  const router = useRouter()

  async function defusionner() {
    setLoading(true)
    setErreur(null)
    try {
      const res = await fetch('/api/business/doublons/defusionner', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fusionId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setErreur(json.erreur ?? 'Erreur serveur')
        setLoading(false)
        return
      }
      window.location.href = '/dashboard/business/doublons/historique'
    } catch {
      setErreur('Erreur réseau — réessaie')
      setLoading(false)
    }
  }

  if (confirme) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <button
            onClick={defusionner}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {loading ? '…' : 'Confirmer'}
          </button>
          <button
            onClick={() => { setConfirme(false); setErreur(null) }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Annuler
          </button>
        </div>
        {erreur && <p className="text-xs text-red-400">{erreur}</p>}
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
