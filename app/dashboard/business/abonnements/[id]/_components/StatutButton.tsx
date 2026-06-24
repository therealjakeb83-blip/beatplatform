'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  aboId: string
  statut: 'actif' | 'annule' | 'impaye'
  annulationEnCours: boolean
}

type Action = 'annuler' | 'reactiver' | 'marquer_actif' | 'annuler_impaye'

export default function StatutButton({ aboId, statut, annulationEnCours }: Props) {
  const router  = useRouter()
  const [loading, setLoading]   = useState<Action | null>(null)
  const [confirm, setConfirm]   = useState<Action | null>(null)
  const [erreur,  setErreur]    = useState('')

  async function executer(action: Action) {
    setLoading(action)
    setErreur('')
    setConfirm(null)

    const res = await fetch(`/api/business/abonnements/${aboId}/statut`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    setLoading(null)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}))
      setErreur(error ?? 'Une erreur est survenue.')
    } else {
      router.refresh()
    }
  }

  if (statut === 'annule') {
    return <p className="text-xs text-gray-600">Cet abonnement n&apos;est plus modifiable.</p>
  }

  if (statut === 'actif' && !annulationEnCours) {
    return (
      <div>
        {confirm === 'annuler' ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">
              L&apos;accès sera maintenu jusqu&apos;à la fin de la période en cours.
            </p>
            <button
              onClick={() => executer('annuler')}
              disabled={loading !== null}
              className="w-full py-2 px-3 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading === 'annuler' ? 'Annulation…' : 'Confirmer l\'annulation'}
            </button>
            <button
              onClick={() => setConfirm(null)}
              className="w-full py-2 px-3 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Retour
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm('annuler')}
            className="w-full py-2 px-3 text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
          >
            Annuler l&apos;abonnement
          </button>
        )}
        {erreur && <p className="text-xs text-red-400 mt-2">{erreur}</p>}
      </div>
    )
  }

  if (statut === 'actif' && annulationEnCours) {
    return (
      <div>
        <button
          onClick={() => executer('reactiver')}
          disabled={loading !== null}
          className="w-full py-2 px-3 text-sm border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-50 rounded-lg transition-colors text-left"
        >
          {loading === 'reactiver' ? 'Réactivation…' : "Réactiver l'abonnement"}
        </button>
        {erreur && <p className="text-xs text-red-400 mt-2">{erreur}</p>}
      </div>
    )
  }

  if (statut === 'impaye') {
    return (
      <div className="space-y-2">
        <button
          onClick={() => executer('marquer_actif')}
          disabled={loading !== null}
          className="w-full py-2 px-3 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors text-left"
        >
          {loading === 'marquer_actif' ? 'Mise à jour…' : 'Marquer comme actif'}
        </button>
        <button
          onClick={() => executer('annuler_impaye')}
          disabled={loading !== null}
          className="w-full py-2 px-3 text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 rounded-lg transition-colors text-left"
        >
          {loading === 'annuler_impaye' ? 'Annulation…' : 'Annuler'}
        </button>
        {erreur && <p className="text-xs text-red-400 mt-2">{erreur}</p>}
      </div>
    )
  }

  return null
}
