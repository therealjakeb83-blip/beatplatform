'use client'

import { useFormStatus } from 'react-dom'

export default function EnvoyerCampagneButton({ label, confirmMessage }: { label: string; confirmMessage: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center gap-1.5"
      onClick={e => { if (!confirm(confirmMessage)) e.preventDefault() }}
    >
      {pending && (
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {pending ? 'Envoi en cours…' : label}
    </button>
  )
}
