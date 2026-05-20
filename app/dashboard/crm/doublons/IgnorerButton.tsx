'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IgnorerButton({
  id1,
  id2,
}: {
  id1: string
  id2: string
}) {
  const [chargement, setChargement] = useState(false)
  const router = useRouter()

  async function ignorer() {
    setChargement(true)
    await fetch('/api/crm/doublons/ignorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id1, id2 }),
    })
    router.refresh()
    setChargement(false)
  }

  return (
    <button
      onClick={ignorer}
      disabled={chargement}
      className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-white transition-colors"
    >
      {chargement ? '…' : 'Ignorer'}
    </button>
  )
}
