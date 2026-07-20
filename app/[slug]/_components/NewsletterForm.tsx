'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function NewsletterForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState('')
  const [accepte, setAccepte] = useState(false)
  const [statut, setStatut] = useState<'idle' | 'envoi' | 'ok' | 'erreur'>('idle')

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (!accepte || statut === 'envoi') return
    setStatut('envoi')

    const res = await fetch('/api/artiste/newsletter-publique', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, email }),
    })

    setStatut(res.ok ? 'ok' : 'erreur')
    if (res.ok) setEmail('')
  }

  if (statut === 'ok') {
    return <p className="text-sm text-brand-400">Inscription confirmée, merci !</p>
  }

  return (
    <form onSubmit={envoyer} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Ton email"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!accepte || statut === 'envoi'}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors whitespace-nowrap"
        >
          S&apos;inscrire
        </button>
      </div>
      <label className="flex items-start gap-2 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={accepte}
          onChange={e => setAccepte(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          J&apos;accepte de recevoir des emails et j&apos;ai lu la{' '}
          <Link href={`/${slug}/confidentialite`} className="underline hover:text-gray-300">
            politique de confidentialité
          </Link>
          .
        </span>
      </label>
      {statut === 'erreur' && (
        <p className="text-xs text-red-400">Une erreur est survenue, réessaie.</p>
      )}
    </form>
  )
}
