'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ConnexionArtisteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/mon-compte'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      setErreur('Email ou mot de passe incorrect.')
      setChargement(false)
      return
    }

    // Lier les abonnements/commandes existants par email
    await fetch('/api/artiste/lier-compte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    window.location.href = redirect
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm mb-4">MP</div>
          <h1 className="text-2xl font-bold text-white mb-1">Mon espace artiste</h1>
          <p className="text-gray-400 text-sm">Accède à tes achats, abonnements et favoris sur toutes les boutiques.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="ton@email.com"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {erreur && <p className="text-red-400 text-sm">{erreur}</p>}

          <button
            type="submit"
            disabled={chargement}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargement ? 'Connexion...' : 'Se connecter'}
          </button>

          <Link
            href="/artiste/mot-de-passe-oublie"
            className="text-sm text-gray-500 hover:text-gray-400 text-center"
          >
            Mot de passe oublié ?
          </Link>
        </form>

        <p className="text-gray-500 text-sm mt-6 text-center">
          Pas encore de compte ?{' '}
          <Link href="/artiste/inscription" className="text-indigo-400 hover:text-indigo-300">
            Créer un compte artiste
          </Link>
        </p>

        <p className="text-gray-700 text-xs mt-4 text-center">
          Tu es beatmaker ?{' '}
          <Link href="/connexion" className="text-gray-600 hover:text-gray-400 transition-colors">
            Connexion producteur →
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function ConnexionArtistePage() {
  return (
    <Suspense>
      <ConnexionArtisteForm />
    </Suspense>
  )
}
