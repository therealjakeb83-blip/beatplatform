'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReprendreLivraisonButton({ commandeId }: { commandeId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [resultat, setResultat] = useState<{ statut: string; contratsRegeneres: number; transfertsReussis: number; echecs: string[] } | null>(null)
  const router = useRouter()

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch(`/api/business/commandes/${commandeId}/reprendre-livraison`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setResultat(data)
      setState('done')
      router.refresh()
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 5000)
    }
  }

  if (state === 'done' && resultat) {
    return (
      <div className="text-xs">
        <p className="text-green-400">
          {resultat.contratsRegeneres > 0 && `${resultat.contratsRegeneres} contrat(s) régénéré(s). `}
          {resultat.transfertsReussis > 0 && `${resultat.transfertsReussis} transfert(s) réussi(s). `}
          {resultat.contratsRegeneres === 0 && resultat.transfertsReussis === 0 && 'Rien de neuf à réparer.'}
        </p>
        {resultat.echecs.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {resultat.echecs.map((e, i) => <li key={i} className="text-red-400">{e}</li>)}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={state === 'loading'}
        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors disabled:opacity-50"
      >
        {state === 'loading' ? 'Reprise en cours…' : 'Réessayer'}
      </button>
      {state === 'error' && <span className="text-xs text-red-400">Erreur, réessaie</span>}
    </div>
  )
}
