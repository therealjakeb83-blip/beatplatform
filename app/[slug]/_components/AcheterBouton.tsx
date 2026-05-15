'use client'

import { useState } from 'react'

export default function AcheterBouton({
  beatId,
  licenceId,
  slug,
  label,
}: {
  beatId: string
  licenceId: string
  slug: string
  label: string
}) {
  const [chargement, setChargement] = useState(false)

  async function acheter() {
    setChargement(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beat_id: beatId, licence_id: licenceId, slug }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setChargement(false)
  }

  return (
    <button
      onClick={acheter}
      disabled={chargement}
      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {chargement ? '...' : label}
    </button>
  )
}
