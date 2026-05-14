'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ConnexionPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErreur('Email ou mot de passe incorrect.')
      setChargement(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Se connecter à My Producer</h1>
        <p className="text-gray-400 mb-8">Accède à ta boutique et ton dashboard.</p>

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

          {erreur && (
            <p className="text-red-400 text-sm">{erreur}</p>
          )}

          <button
            type="submit"
            disabled={chargement}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargement ? 'Connexion...' : 'Se connecter'}
          </button>

          <Link
            href="/mot-de-passe-oublie"
            className="text-sm text-gray-500 hover:text-gray-400 text-center"
          >
            Mot de passe oublié ?
          </Link>
        </form>

        <p className="text-gray-500 text-sm mt-6 text-center">
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="text-indigo-400 hover:text-indigo-300">
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  )
}
