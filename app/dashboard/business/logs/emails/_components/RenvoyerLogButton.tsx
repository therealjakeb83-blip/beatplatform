'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RenvoyerLogButton({ logId }: { logId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setState('sending')
    try {
      const res = await fetch(`/api/business/logs/${logId}/renvoyer`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setState('ok')
      router.refresh()
      setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'ok') {
    return <span className="text-xs text-green-400 px-1.5 whitespace-nowrap">Renvoyé</span>
  }
  if (state === 'error') {
    return <span className="text-xs text-red-400 px-1.5 whitespace-nowrap">Échec</span>
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'sending'}
      title="Renvoyer cet email"
      className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
    >
      <svg className={`w-3.5 h-3.5 ${state === 'sending' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  )
}
