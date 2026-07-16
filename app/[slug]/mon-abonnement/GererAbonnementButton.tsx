'use client'

import { useState } from 'react'

export default function GererAbonnementButton({
  subscriptionId,
  slug,
  impaye = false,
}: {
  subscriptionId: string
  slug: string
  impaye?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [annule, setAnnule] = useState(false)
  const [loadingPortail, setLoadingPortail] = useState(false)
  const [erreurPortail, setErreurPortail] = useState<string | null>(null)

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
        setAnnule(true)
        setLoading(false)
      } else {
        alert(data.erreur ?? 'Erreur lors de l\'annulation.')
        setLoading(false)
      }
    } catch {
      alert('Impossible de joindre le serveur.')
      setLoading(false)
    }
  }

  async function ouvrirPortail() {
    setLoadingPortail(true)
    setErreurPortail(null)
    try {
      const res = await fetch('/api/stripe/abonnement/portail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscriptionId, slug }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setErreurPortail(data.erreur ?? 'Erreur lors de l\'ouverture du portail.')
        setLoadingPortail(false)
      }
    } catch {
      setErreurPortail('Impossible de joindre le serveur.')
      setLoadingPortail(false)
    }
  }

  if (annule) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
        <p className="text-green-400 text-sm font-semibold mb-1">Annulation planifiée</p>
        <p className="text-gray-400 text-xs">Tu garderas l&apos;accès jusqu&apos;à la fin de la période en cours.</p>
      </div>
    )
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
    <div className="flex flex-col gap-3">
      {impaye && (
        <div className="flex flex-col gap-2">
          <button
            onClick={ouvrirPortail}
            disabled={loadingPortail}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {loadingPortail ? 'Ouverture...' : 'Mettre à jour mon moyen de paiement'}
          </button>
          {erreurPortail && <p className="text-red-400 text-xs text-center">{erreurPortail}</p>}
        </div>
      )}
      <button
        onClick={() => setConfirmer(true)}
        className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm font-semibold transition-colors"
      >
        Annuler mon abonnement
      </button>
    </div>
  )
}
