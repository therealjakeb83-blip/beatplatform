'use client'

import { useState } from 'react'
import FreeDLModal from './FreeDLModal'

export default function FreeDLButton({
  beatId,
  beatTitre,
  slug,
  clientId,
}: {
  beatId: string
  beatTitre: string
  slug: string
  clientId: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600/90 hover:bg-green-500 text-white font-bold text-sm transition-colors"
      >
        ↓ Télécharger gratuitement
      </button>
      <FreeDLModal
        open={open}
        onClose={() => setOpen(false)}
        beatId={beatId}
        beatTitre={beatTitre}
        slug={slug}
        clientId={clientId}
      />
    </>
  )
}
