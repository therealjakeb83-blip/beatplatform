'use client'

import { useFormStatus } from 'react-dom'
import { useEffect, useState } from 'react'

export default function IdentiteSaveButton() {
  const { pending } = useFormStatus()
  const [success, setSuccess]     = useState(false)
  const [wasPending, setWasPending] = useState(false)

  useEffect(() => {
    if (pending) {
      setWasPending(true)
    } else if (wasPending) {
      setSuccess(true)
      setWasPending(false)
      const t = setTimeout(() => setSuccess(false), 2000)
      return () => clearTimeout(t)
    }
  }, [pending, wasPending])

  if (pending) {
    return (
      <button disabled type="submit" className="mt-3 text-xs px-3 py-1.5 rounded-md bg-gray-700 border border-gray-600 text-gray-400 cursor-not-allowed flex items-center gap-1.5">
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Sauvegarde…
      </button>
    )
  }

  if (success) {
    return (
      <button disabled className="mt-3 text-xs px-3 py-1.5 rounded-md bg-green-600/20 border border-green-500/40 text-green-400 transition-colors flex items-center gap-1.5">
        ✓ Sauvegardé
      </button>
    )
  }

  return (
    <button type="submit" className="mt-3 text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-colors">
      Sauvegarder
    </button>
  )
}
