'use client'

import { useState } from 'react'

export default function SAbonnerButton({
  slug,
  prixAffiche,
}: {
  slug: string
  prixAffiche: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setErreur(null)
    try {
      const source_marketing = sessionStorage.getItem('source_marketing') ?? 'direct'
      const res = await fetch('/api/stripe/abonnement/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, source_marketing }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setErreur(data.erreur ?? 'Une erreur est survenue.')
        setLoading(false)
      }
    } catch {
      setErreur('Impossible de joindre le serveur.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold transition-colors text-lg shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]"
      >
        {loading
          ? 'Redirection...'
          : prixAffiche
          ? `S'abonner pour ${prixAffiche}€/mois`
          : `S'abonner`}
      </button>
      {erreur && <p className="text-red-400 text-sm text-center mt-3">{erreur}</p>}
    </div>
  )
}
