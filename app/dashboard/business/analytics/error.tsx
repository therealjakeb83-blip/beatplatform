'use client'

import { useEffect } from 'react'

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Analytics] Erreur:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="bg-gray-900 border border-red-500/30 rounded-xl p-6 max-w-lg w-full">
        <p className="text-red-400 font-semibold text-sm mb-2">Erreur Analytics</p>
        <p className="text-gray-300 text-xs mb-4 font-mono break-all">{error.message}</p>
        {error.digest && (
          <p className="text-gray-600 text-[10px] mb-4">digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
        >
          Réessayer
        </button>
      </div>
    </div>
  )
}
