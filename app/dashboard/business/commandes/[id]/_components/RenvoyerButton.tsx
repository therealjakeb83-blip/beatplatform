'use client'

import { useState } from 'react'

export default function RenvoyerButton({
  commandeId,
  destinataire,
}: {
  commandeId: string
  destinataire: string
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  async function handleClick() {
    setState('sending')
    try {
      const res = await fetch(`/api/business/commandes/${commandeId}/renvoyer`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error()
      setState('ok')
      setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={state === 'sending' || state === 'ok'}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50
          bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-indigo-600"
      >
        {state === 'sending' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Envoi…
          </>
        ) : state === 'ok' ? (
          <>
            <svg className="w-4 h-4 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Envoyé
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Renvoyer par email
          </>
        )}
      </button>
      {state === 'ok' && (
        <span className="text-xs text-green-400">Envoyé à {destinataire}</span>
      )}
      {state === 'error' && (
        <span className="text-xs text-red-400">Échec de l&apos;envoi</span>
      )}
    </div>
  )
}
