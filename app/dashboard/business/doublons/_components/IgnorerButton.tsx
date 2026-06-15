'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IgnorerButton({ id1, id2 }: { id1: string; id2: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function ignorer() {
    setLoading(true)
    await fetch('/api/crm/doublons/ignorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id1, id2 }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={ignorer}
      disabled={loading}
      className="text-xs px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
    >
      {loading ? '…' : 'Ignorer'}
    </button>
  )
}
