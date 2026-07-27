'use client'

import { useState, useTransition } from 'react'

type Props = {
  logId: string
  action: (logId: string) => Promise<{ ok?: boolean; erreur?: string }>
}

export default function RenvoyerButton({ logId, action }: Props) {
  const [pending, startTransition] = useTransition()
  const [resultat, setResultat] = useState<{ ok?: boolean; erreur?: string } | null>(null)

  if (resultat?.ok) return <span className="text-[11px] text-emerald-400">Renvoyé ✓</span>

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={() => startTransition(async () => setResultat(await action(logId)))}
        disabled={pending}
        className="text-[11px] px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
      >
        {pending ? 'Envoi…' : 'Renvoyer'}
      </button>
      {resultat?.erreur && <span className="text-[10px] text-red-400 max-w-[220px] text-right">{resultat.erreur}</span>}
    </div>
  )
}
