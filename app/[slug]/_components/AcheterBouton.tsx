'use client'

import { useState } from 'react'

export default function AcheterBouton({
  beatId,
  licenceId,
  slug,
  label,
  codePromo,
  emailAcheteur,
}: {
  beatId: string
  licenceId: string
  slug: string
  label: string
  codePromo?: string
  emailAcheteur?: string
}) {
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function acheter() {
    setChargement(true)
    setErreur(null)
    const source_marketing = sessionStorage.getItem('source_marketing') ?? 'direct'
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beat_id: beatId, licence_id: licenceId, slug, code_promo: codePromo, email_acheteur: emailAcheteur, source_marketing }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setErreur(data.erreur ?? 'Erreur lors du paiement')
      setChargement(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={acheter}
        disabled={chargement}
        className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]"
      >
        {chargement ? '...' : label}
      </button>
      {erreur && <p className="text-red-400 text-xs">{erreur}</p>}
    </div>
  )
}
