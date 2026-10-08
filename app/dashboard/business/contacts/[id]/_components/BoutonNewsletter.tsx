'use client'

import { useFormStatus } from 'react-dom'

export default function BoutonNewsletter({ inscrit }: { inscrit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
        inscrit
          ? 'bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400'
          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
      }`}
    >
      {pending ? '…' : inscrit ? 'Désinscrire' : 'Inscrire'}
    </button>
  )
}
