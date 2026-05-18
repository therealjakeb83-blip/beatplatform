'use client'

import { useState } from 'react'

export default function GererAbonnementButton({
  subscriptionId,
  slug,
}: {
  subscriptionId: string
  slug: string
}) {
  const [loading, setLoading] = useState(false)
  const [confirmer, setConfirmer] = useState(false)

  async function annuler() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/abonnement/annuler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscriptionId, slug }),
      })
      const data = await res.json()
      if (data.ok) {
        window.location.reload()
      } else {
        alert(data.erreur ?? 'Erreur lors de l\'annulation.')
        setLoading(false)
      }
    } catch {
      alert('Impossible de joindre le serveur.')
      setLoading(false)
    }
  }

  if (confirmer) {
    return (
      <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4">
        <p className="text-sm text-gray-300 mb-4">
          Ton abonnement sera annulé à la fin de la période en cours. Tu garderas l&apos;accès jusqu&apos;à cette date.
        </p>
        <div className="flex gap-3">
          <button
            onClick={annuler}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {loading ? 'Annulation...' : 'Confirmer l\'annulation'}
          </button>
          <button
            onClick={() => setConfirmer(false)}
            className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirmer(true)}
      className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm font-semibold transition-colors"
    >
      Annuler mon abonnement
    </button>
  )
}
