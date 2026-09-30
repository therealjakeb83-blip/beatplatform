'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Commande à 0 € (beat offert) : rien à rembourser, mais A peut l'annuler —
// licence révoquée, accès aux fichiers fermé (Phase 13, lot 4a).
export default function AnnulerCommandeButton({ commandeId }: { commandeId: string }) {
  const [etat, setEtat] = useState<'repos' | 'confirmation' | 'envoi' | 'fini' | 'erreur'>('repos')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function confirmer() {
    setEtat('envoi')
    try {
      const res = await fetch(`/api/business/commandes/${commandeId}/annuler`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue')
      setEtat('fini')
      setTimeout(() => router.refresh(), 800)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur inconnue')
      setEtat('erreur')
    }
  }

  if (etat === 'fini') return <span className="text-xs text-green-400">Commande annulée, licence révoquée.</span>

  if (etat === 'envoi') {
    return (
      <span className="text-sm text-gray-300 flex items-center gap-2">
        <span className="inline-block w-3.5 h-3.5 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
        Annulation en cours…
      </span>
    )
  }

  if (etat === 'confirmation') {
    return (
      <div className="space-y-3 max-w-xl">
        <p className="text-sm text-gray-200">
          Annuler cette commande ? Elle n&apos;a rien coûté au client : il n&apos;y a rien à rembourser, mais la licence ne sera plus valable
          et l&apos;accès aux fichiers sera fermé. Le client en est prévenu par email.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={confirmer} className="px-3 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white transition-colors">
            Confirmer l&apos;annulation
          </button>
          <button onClick={() => setEtat('repos')} className="px-3 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-white transition-colors">
            Retour
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setEtat('confirmation')}
        className="px-4 py-1.5 rounded-lg text-sm border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
      >
        Annuler la commande
      </button>
      {etat === 'erreur' && message && <p className="text-xs text-red-400">{message}</p>}
    </div>
  )
}
