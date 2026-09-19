'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VerificationGate({ commandeId }: { commandeId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setChargement(true)
    try {
      const res = await fetch(`/api/telechargement/${commandeId}/verifier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json() as { ok: boolean; erreur?: string }
      if (data.ok) {
        router.refresh()
      } else {
        setErreur(data.erreur ?? 'Cet email ne correspond pas à cette commande.')
      }
    } catch {
      setErreur('Une erreur est survenue, réessaie.')
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-black mb-1">Confirme ton email</h1>
          <p className="text-gray-400 text-sm">Entre l&apos;email utilisé pour cette commande afin d&apos;accéder à tes fichiers.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ton@email.com"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gray-500"
          />
          {erreur && <p className="text-red-400 text-xs">{erreur}</p>}
          <button
            type="submit"
            disabled={chargement}
            className="w-full px-4 py-3 rounded-xl bg-white text-gray-950 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {chargement ? 'Vérification...' : 'Accéder à mes fichiers'}
          </button>
        </form>
      </div>
    </div>
  )
}
