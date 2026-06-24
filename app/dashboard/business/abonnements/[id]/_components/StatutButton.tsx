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
  const [loading,  setLoading]  = useState<Action | null>(null)
  const [confirm,  setConfirm]  = useState(false)
  const [succes,   setSucces]   = useState('')
  const [erreur,   setErreur]   = useState('')

  async function executer(action: Action) {
    setLoading(action)
    setErreur('')
    setSucces('')
    setConfirm(false)

    try {
      const res = await fetch(`/api/business/abonnements/${aboId}/statut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setErreur(json.error ?? 'Une erreur est survenue.')
      } else {
        setSucces(
          action === 'annuler'       ? "Annulation programmée pour la fin de la période." :
          action === 'reactiver'     ? "Abonnement réactivé avec succès."                :
          action === 'marquer_actif' ? "Abonnement marqué comme actif."                  :
                                      "Abonnement annulé."
        )
        router.refresh()
      }
    } catch {
      setErreur('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(null)
    }
  }

  if (statut === 'annule') {
    return <p className="text-xs text-gray-600">Cet abonnement n&apos;est plus modifiable.</p>
  }

  if (statut === 'actif' && !annulationEnCours) {
    return (
      <div className="space-y-3">
        {confirm ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-300">
              L&apos;accès sera maintenu jusqu&apos;à la fin de la période en cours. Aucun remboursement ne sera effectué.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => executer('annuler')}
                disabled={loading !== null}
                className="flex-1 py-2 px-3 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
              >
                {loading === 'annuler' ? 'Annulation…' : 'Confirmer'}
              </button>
              <button
                onClick={() => setConfirm(false)}
                disabled={loading !== null}
                className="flex-1 py-2 px-3 text-sm border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 rounded-lg transition-colors"
              >
                Retour
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            disabled={loading !== null}
            className="w-full py-2 px-3 text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
          >
            Annuler l&apos;abonnement
          </button>
        )}
        {succes && <p className="text-xs text-green-400">{succes}</p>}
        {erreur && <p className="text-xs text-red-400">{erreur}</p>}
      </div>
    )
  }

  if (statut === 'actif' && annulationEnCours) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Annulation programmée. Le client garde l&apos;accès jusqu&apos;à la fin de la période.
        </p>
        <button
          onClick={() => executer('reactiver')}
          disabled={loading !== null}
          className="w-full py-2 px-3 text-sm border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-50 rounded-lg transition-colors text-left"
        >
          {loading === 'reactiver' ? 'Réactivation…' : "Réactiver l'abonnement"}
        </button>
        {succes && <p className="text-xs text-green-400">{succes}</p>}
        {erreur && <p className="text-xs text-red-400">{erreur}</p>}
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
        {succes && <p className="text-xs text-green-400">{succes}</p>}
        {erreur && <p className="text-xs text-red-400">{erreur}</p>}
      </div>
    )
  }

  return null
}
