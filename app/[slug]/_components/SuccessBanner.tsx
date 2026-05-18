'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function SuccessBanner() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const sessionId = searchParams.get('session_id')
  const [commandeId, setCommandeId] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)

  useEffect(() => {
    if (!success || !sessionId) return
    setChargement(true)
    fetch(`/api/telechargement/lookup?session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => { if (d.commande_id) setCommandeId(d.commande_id) })
      .finally(() => setChargement(false))
  }, [success, sessionId])

  if (!success) return null

  return (
    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-8 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-green-400 text-sm">Paiement confirmé !</p>
          <p className="text-gray-400 text-xs">Tes fichiers sont prêts à être téléchargés.</p>
        </div>
      </div>
      {chargement && <p className="text-gray-500 text-xs">Préparation de tes fichiers...</p>}
      {commandeId && !chargement && (
        <a
          href={`/telechargement/${commandeId}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Télécharger ma licence
        </a>
      )}
    </div>
  )
}
